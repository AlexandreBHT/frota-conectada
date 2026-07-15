import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AppRole, Maintenance, Trip, Vehicle } from "./fleet-types";

// ---------- Me / Role ----------

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("full_name, email").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const roles = (rolesRes.data ?? []).map((r: { role: AppRole }) => r.role);
    const role: AppRole = roles.includes("gestor") ? "gestor" : "motorista";
    return {
      userId,
      email: (profileRes.data?.email as string | null) ?? "",
      fullName: (profileRes.data?.full_name as string | null) ?? null,
      role,
    };
  });

// ---------- Vehicles ----------

export const listVehicles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("vehicles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Vehicle[];
  });

export const createVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    plate: string; model: string; year: number; odometer: number;
    fuel_type: Vehicle["fuel_type"];
  }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("vehicles").insert({
      plate: data.plate,
      model: data.model,
      year: data.year,
      odometer: data.odometer,
      fuel_type: data.fuel_type,
      status: "disponivel",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Trips ----------

export const listTrips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("trips")
      .select("*")
      .order("started_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Trip[];
  });

export const startTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    vehicle_id: string; driver_name: string; destination: string;
    start_km: number; checklist: Record<string, boolean>; notes?: string;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error: tripError } = await supabase.from("trips").insert({
      vehicle_id: data.vehicle_id,
      driver_id: userId,
      driver_name: data.driver_name,
      destination: data.destination,
      start_km: data.start_km,
      checklist: data.checklist,
      notes: data.notes ?? null,
    });
    if (tripError) throw new Error(tripError.message);

    // Update vehicle status via service role (motorista cannot UPDATE vehicles via RLS).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: vErr } = await supabaseAdmin
      .from("vehicles")
      .update({ status: "em_uso" })
      .eq("id", data.vehicle_id);
    if (vErr) throw new Error(vErr.message);
    return { ok: true };
  });

export const endTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    trip_id: string; end_km: number; fuel_liters: number; fuel_cost: number; notes?: string;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verify ownership (or gestor)
    const { data: trip, error: tErr } = await supabase
      .from("trips")
      .select("id, vehicle_id, driver_id, start_km")
      .eq("id", data.trip_id)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!trip) throw new Error("Trajeto não encontrado");

    const { error: uErr } = await supabase
      .from("trips")
      .update({
        end_km: data.end_km,
        fuel_liters: data.fuel_liters,
        fuel_cost: data.fuel_cost,
        notes: data.notes ?? null,
        ended_at: new Date().toISOString(),
      })
      .eq("id", data.trip_id);
    if (uErr) throw new Error(uErr.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: vErr } = await supabaseAdmin
      .from("vehicles")
      .update({ status: "disponivel", odometer: data.end_km })
      .eq("id", trip.vehicle_id);
    if (vErr) throw new Error(vErr.message);
    // silence unused warnings
    void userId;
    return { ok: true };
  });

// ---------- Maintenances ----------

export const listMaintenances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("maintenances")
      .select("*")
      .order("date", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Maintenance[];
  });

export const createMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    vehicle_id: string; type: Maintenance["type"]; description: string;
    date: string; cost: number; odometer: number; status: Maintenance["status"];
    km_interval?: number | null; months_interval?: number | null;
    last_done_at?: string | null; last_done_km?: number | null;
  }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("maintenances").insert({
      vehicle_id: data.vehicle_id,
      type: data.type,
      description: data.description,
      date: data.date,
      cost: data.cost,
      odometer: data.odometer,
      status: data.status,
      km_interval: data.km_interval ?? null,
      months_interval: data.months_interval ?? null,
      last_done_at: data.last_done_at ?? null,
      last_done_km: data.last_done_km ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const completeMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; done_at: string; done_km: number }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("maintenances")
      .update({
        status: "concluida",
        last_done_at: data.done_at,
        last_done_km: data.done_km,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
