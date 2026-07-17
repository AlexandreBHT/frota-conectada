import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Truck, ClipboardCheck, Fuel, Wrench, Plus, Play, CheckCircle2,
  AlertTriangle, Calendar, LogOut, BarChart3,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import {
  getMe, listVehicles, listTrips, listMaintenances,
  createVehicle, startTrip, endTrip, createMaintenance, completeMaintenance,
} from "@/lib/fleet.functions";
import {
  CHECKLIST_LABELS, CHECKLIST_KEYS, STATUS_LABEL, STATUS_STYLES, MAINT_TYPE_LABEL,
  VEHICLE_TYPE_LABEL, type ChecklistItem, type Vehicle, type Trip, type Maintenance,
} from "@/lib/fleet-types";
import { getSaoPauloRodizioStatus } from "@/lib/traffic/sao-paulo-rodizio";
import { computeAllAlerts } from "@/lib/fleet-alerts";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/")({
  component: FleetDashboard,
});

function currency(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => getMe() });
}
function useVehicles() {
  return useQuery({ queryKey: ["vehicles"], queryFn: () => listVehicles() });
}
function useTrips() {
  return useQuery({ queryKey: ["trips"], queryFn: () => listTrips() });
}
function useMaintenances() {
  return useQuery({ queryKey: ["maintenances"], queryFn: () => listMaintenances() });
}

function FleetDashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [todayStr, setTodayStr] = useState<string>("");

  useEffect(() => {
    setTodayStr(new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }));
  }, []);

  const meQ = useMe();
  const vehiclesQ = useVehicles();
  const tripsQ = useTrips();
  const maintQ = useMaintenances();

  const vehicles = vehiclesQ.data ?? [];
  const trips = tripsQ.data ?? [];
  const maintenances = maintQ.data ?? [];
  const isGestor = meQ.data?.role === "gestor";

  const activeTrips = trips.filter((t) => !t.ended_at);
  const completedTrips = trips.filter((t) => t.ended_at);
  const totalKm = completedTrips.reduce((a, t) => a + ((t.end_km ?? 0) - t.start_km), 0);
  const totalLiters = completedTrips.reduce((a, t) => a + (t.fuel_liters ?? 0), 0);
  const totalFuelCost = completedTrips.reduce((a, t) => a + (t.fuel_cost ?? 0), 0);
  const avgConsumption = totalLiters > 0 ? totalKm / totalLiters : 0;
  const upcomingMaint = maintenances.filter((m) => m.status === "agendada");
  const maintCost = maintenances.filter((m) => m.status === "concluida").reduce((a, m) => a + Number(m.cost), 0);

  const alerts = useMemo(() => computeAllAlerts(maintenances, vehicles), [maintenances, vehicles]);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const loading = meQ.isLoading || vehiclesQ.isLoading || tripsQ.isLoading || maintQ.isLoading;

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">FrotaControl</h1>
              <p className="text-xs text-muted-foreground">
                {meQ.data ? `${meQ.data.fullName ?? meQ.data.email} · ${meQ.data.role === "gestor" ? "Gestor" : "Motorista"}` : "Carregando..."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span suppressHydrationWarning>{todayStr}</span>
            </div>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {alerts.length > 0 && <AlertsBanner alerts={alerts} onGo={() => setTab("maintenance")} />}

        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <StatCard icon={<Truck className="h-4 w-4" />} label="Veículos" value={String(vehicles.length)} hint={`${vehicles.filter(v => v.status === "disponivel").length} disponíveis`} />
          <StatCard icon={<Play className="h-4 w-4" />} label="Trajetos ativos" value={String(activeTrips.length)} hint={`${completedTrips.length} concluídos`} />
          <StatCard icon={<Fuel className="h-4 w-4" />} label="Consumo médio" value={`${avgConsumption.toFixed(1)} km/L`} hint={`${totalLiters.toFixed(0)} L · ${currency(totalFuelCost)}`} />
          <StatCard icon={<Wrench className="h-4 w-4" />} label="Manutenções" value={String(upcomingMaint.length)} hint={`${currency(maintCost)} gastos`} />
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando dados...</p>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-6 flex-wrap">
              <TabsTrigger value="overview"><Truck className="mr-2 h-4 w-4" />Veículos</TabsTrigger>
              <TabsTrigger value="checklist"><ClipboardCheck className="mr-2 h-4 w-4" />Iniciar Trajeto</TabsTrigger>
              <TabsTrigger value="fuel"><Fuel className="mr-2 h-4 w-4" />Consumo</TabsTrigger>
              <TabsTrigger value="maintenance">
                <Wrench className="mr-2 h-4 w-4" />Manutenções
                {alerts.length > 0 && <Badge variant="destructive" className="ml-2">{alerts.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="reports"><BarChart3 className="mr-2 h-4 w-4" />Relatórios</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <VehiclesTab vehicles={vehicles} isGestor={isGestor} />
            </TabsContent>
            <TabsContent value="checklist">
              <ChecklistTab
                vehicles={vehicles} trips={trips}
                driverName={meQ.data?.fullName ?? meQ.data?.email ?? ""}
                onDone={() => setTab("fuel")}
              />
            </TabsContent>
            <TabsContent value="fuel">
              <FuelTab trips={completedTrips} vehicles={vehicles} />
            </TabsContent>
            <TabsContent value="maintenance">
              <MaintenanceTab
                maintenances={maintenances} vehicles={vehicles} isGestor={isGestor}
              />
            </TabsContent>
            <TabsContent value="reports">
              <ReportsTab trips={completedTrips} maintenances={maintenances} vehicles={vehicles} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {icon}{label}
        </div>
        <div className="mt-3 text-2xl font-bold tracking-tight">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{hint}</div>
      </CardContent>
    </Card>
  );
}

function AlertsBanner({ alerts, onGo }: { alerts: ReturnType<typeof computeAllAlerts>; onGo: () => void }) {
  const vencidas = alerts.filter((a) => a.status === "vencida").length;
  const proximas = alerts.filter((a) => a.status === "proxima").length;
  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-700 mt-0.5" />
        <div className="flex-1">
          <div className="font-semibold text-amber-900">
            {vencidas > 0 && `${vencidas} manutenção(ões) vencida(s)`}
            {vencidas > 0 && proximas > 0 && " · "}
            {proximas > 0 && `${proximas} próxima(s) do vencimento`}
          </div>
          <ul className="mt-1 text-sm text-amber-800 space-y-0.5">
            {alerts.slice(0, 3).map((a) => (
              <li key={a.maintenance.id}>
                <span className="font-mono">{a.vehicle?.plate ?? "?"}</span> — {a.maintenance.description}: {a.reason}
              </li>
            ))}
            {alerts.length > 3 && <li className="italic">e mais {alerts.length - 3}...</li>}
          </ul>
        </div>
        <Button size="sm" variant="outline" onClick={onGo}>Ver</Button>
      </div>
    </div>
  );
}

// ---------- Vehicles Tab ----------

function VehiclesTab({ vehicles, isGestor }: { vehicles: Vehicle[]; isGestor: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ plate: "", model: "", year: 2024, odometer: 0, fuel_type: "flex" as Vehicle["fuel_type"], vehicle_type: "utilitario" as Vehicle["vehicle_type"], max_load_kg: 0 });
  const m = useMutation({
    mutationFn: () => createVehicle({ data: form }),
    onSuccess: () => {
      toast.success("Veículo adicionado");
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      setOpen(false);
      setForm({ plate: "", model: "", year: 2024, odometer: 0, fuel_type: "flex", vehicle_type: "utilitario", max_load_kg: 0 });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Frota</CardTitle>
          <CardDescription>Todos os veículos cadastrados</CardDescription>
        </div>
        {isGestor && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Novo veículo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar veículo</DialogTitle>
                <DialogDescription>Adicione um novo veículo à frota</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2"><Label>Placa</Label>
                  <Input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })} placeholder="ABC1D23" />
                </div>
                <div className="grid gap-2"><Label>Modelo</Label>
                  <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Fiat Fiorino" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Ano</Label>
                    <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
                  </div>
                  <div className="grid gap-2"><Label>KM atual</Label>
                    <Input type="number" value={form.odometer} onChange={(e) => setForm({ ...form, odometer: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Tipo do veículo</Label>
                    <Select value={form.vehicle_type} onValueChange={(v) => setForm({ ...form, vehicle_type: v as Vehicle["vehicle_type"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(VEHICLE_TYPE_LABEL).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2"><Label>Capacidade de carga (kg)</Label>
                    <Input type="number" min={0} value={form.max_load_kg} onChange={(e) => setForm({ ...form, max_load_kg: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="grid gap-2"><Label>Combustível</Label>
                  <Select value={form.fuel_type} onValueChange={(v) => setForm({ ...form, fuel_type: v as Vehicle["fuel_type"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gasolina">Gasolina</SelectItem>
                      <SelectItem value="diesel">Diesel</SelectItem>
                      <SelectItem value="etanol">Etanol</SelectItem>
                      <SelectItem value="flex">Flex</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => {
                  if (!form.plate || !form.model) return toast.error("Preencha placa e modelo");
                  m.mutate();
                }} disabled={m.isPending}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {vehicles.length === 0 && <p className="text-sm text-muted-foreground">Nenhum veículo cadastrado.</p>}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v) => (
            <div key={v.id} className="rounded-lg border bg-card p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-sm font-bold">{v.plate}</div>
                  <div className="text-sm text-muted-foreground">{v.model}</div>
                </div>
                <Badge variant="outline" className={STATUS_STYLES[v.status]}>{STATUS_LABEL[v.status]}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Ano:</span> <span className="font-medium">{v.year}</span></div>
                <div><span className="text-muted-foreground">KM:</span> <span className="font-medium">{v.odometer.toLocaleString("pt-BR")}</span></div>
                <div><span className="text-muted-foreground">Tipo:</span> <span className="font-medium">{VEHICLE_TYPE_LABEL[v.vehicle_type]}</span></div>
                <div><span className="text-muted-foreground">Carga:</span> <span className="font-medium">{v.max_load_kg.toLocaleString("pt-BR")} kg</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">Combustível:</span> <span className="font-medium capitalize">{v.fuel_type}</span></div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Checklist Tab ----------

const emptyChecklist = () =>
  CHECKLIST_KEYS.reduce((a, k) => ({ ...a, [k]: false }), {} as Record<ChecklistItem, boolean>);

function ChecklistTab({
  vehicles, trips, driverName, onDone,
}: { vehicles: Vehicle[]; trips: Trip[]; driverName: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [vehicleId, setVehicleId] = useState("");
  const [destination, setDestination] = useState("");
  const [checklist, setChecklist] = useState<Record<ChecklistItem, boolean>>(emptyChecklist());
  const [notes, setNotes] = useState("");

  const activeTrips = trips.filter((t) => !t.ended_at);
  const available = vehicles.filter((v) => v.status === "disponivel");
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);
  const allChecked = CHECKLIST_KEYS.every((k) => checklist[k]);
  const rodizio = selectedVehicle ? getSaoPauloRodizioStatus(selectedVehicle.plate) : null;

  const startM = useMutation({
    mutationFn: () => startTrip({
      data: {
        vehicle_id: vehicleId,
        driver_name: driverName,
        destination,
        start_km: selectedVehicle?.odometer ?? 0,
        checklist,
        notes: notes || undefined,
      },
    }),
    onSuccess: () => {
      toast.success("Trajeto iniciado! Boa viagem 🚛");
      qc.invalidateQueries({ queryKey: ["trips"] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      setVehicleId(""); setDestination(""); setChecklist(emptyChecklist()); setNotes("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Checklist pré-viagem</CardTitle>
          <CardDescription>Confira todos os itens antes de liberar o veículo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Veículo</Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {available.length === 0 && <div className="p-2 text-xs text-muted-foreground">Nenhum disponível</div>}
                  {available.map((v) => (<SelectItem key={v.id} value={v.id}>{v.plate} — {v.model}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Motorista</Label>
              <Input value={driverName} disabled />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Destino</Label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Ex.: Cliente X - São Paulo/SP" />
            </div>
          </div>
          {selectedVehicle && (
            <div className={`rounded-lg border p-4 ${rodizio?.active ? "border-red-300 bg-red-50" : rodizio?.restrictionDay ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
              <div className="flex items-start gap-3">
                <AlertTriangle className={`mt-0.5 h-5 w-5 ${rodizio?.active ? "text-red-700" : rodizio?.restrictionDay ? "text-amber-700" : "text-emerald-700"}`} />
                <div>
                  <div className="font-semibold">Situação do rodízio — placa {selectedVehicle.plate}</div>
                  <div className="text-sm">{rodizio?.message}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Aviso inicial baseado no rodízio municipal. Suspensões, feriados e restrições específicas de caminhões serão integrados em uma etapa futura.</div>
                </div>
              </div>
            </div>
          )}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Itens de segurança</h3>
              <span className="text-xs text-muted-foreground">{CHECKLIST_KEYS.filter((k) => checklist[k]).length}/{CHECKLIST_KEYS.length}</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {CHECKLIST_KEYS.map((k) => (
                <label key={k} className="flex items-center gap-3 rounded-md border bg-card p-3 hover:bg-accent cursor-pointer">
                  <Checkbox checked={checklist[k]} onCheckedChange={(v) => setChecklist({ ...checklist, [k]: Boolean(v) })} />
                  <span className="text-sm">{CHECKLIST_LABELS[k]}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Observações (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Alguma anomalia identificada?" rows={2} />
          </div>
          <Button size="lg" className="w-full" disabled={!allChecked || !vehicleId || !destination || startM.isPending}
            onClick={() => startM.mutate()}>
            <Play className="mr-2 h-4 w-4" />Iniciar trajeto
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trajetos em andamento</CardTitle>
          <CardDescription>Encerre para registrar o consumo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeTrips.length === 0 && <p className="text-sm text-muted-foreground">Nenhum trajeto ativo.</p>}
          {activeTrips.map((t) => {
            const v = vehicles.find((x) => x.id === t.vehicle_id);
            return <ActiveTripCard key={t.id} trip={t} plate={v?.plate ?? ""} onEnd={onDone} />;
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function ActiveTripCard({ trip, plate, onEnd }: { trip: Trip; plate: string; onEnd: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [endKm, setEndKm] = useState(trip.start_km);
  const [liters, setLiters] = useState(0);
  const [cost, setCost] = useState(0);

  const m = useMutation({
    mutationFn: () => endTrip({ data: { trip_id: trip.id, end_km: endKm, fuel_liters: liters, fuel_cost: cost } }),
    onSuccess: () => {
      toast.success("Trajeto encerrado");
      qc.invalidateQueries({ queryKey: ["trips"] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      setOpen(false);
      onEnd();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-bold">{plate}</span>
        <Badge className="bg-blue-100 text-blue-800 border-blue-200" variant="outline">Em rota</Badge>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">{trip.driver_name}</div>
      <div className="text-xs mt-1">{trip.destination}</div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="w-full mt-3">
            <CheckCircle2 className="mr-2 h-3 w-3" />Encerrar
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar trajeto</DialogTitle>
            <DialogDescription>Informe os dados finais do trajeto</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>KM final (inicial: {trip.start_km.toLocaleString("pt-BR")})</Label>
              <Input type="number" value={endKm} onChange={(e) => setEndKm(Number(e.target.value))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Litros abastecidos</Label>
                <Input type="number" value={liters} onChange={(e) => setLiters(Number(e.target.value))} />
              </div>
              <div className="grid gap-2"><Label>Custo (R$)</Label>
                <Input type="number" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => {
              if (endKm <= trip.start_km) return toast.error("KM final deve ser maior que o inicial");
              m.mutate();
            }} disabled={m.isPending}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Fuel Tab ----------

function FuelTab({ trips, vehicles }: { trips: Trip[]; vehicles: Vehicle[] }) {
  const rows = trips
    .filter((t) => t.end_km != null && t.fuel_liters)
    .map((t) => {
      const km = (t.end_km ?? 0) - t.start_km;
      const l = Number(t.fuel_liters ?? 0);
      const v = vehicles.find((x) => x.id === t.vehicle_id);
      return {
        id: t.id,
        plate: v?.plate ?? "?",
        driver: t.driver_name,
        destination: t.destination,
        date: t.ended_at ?? t.started_at,
        km,
        liters: l,
        cost: Number(t.fuel_cost ?? 0),
        kml: l > 0 ? km / l : 0,
      };
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consumo por trajeto</CardTitle>
        <CardDescription>Histórico completo com quilometragem, litros e custo</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum trajeto concluído ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead className="text-right">KM</TableHead>
                <TableHead className="text-right">Litros</TableHead>
                <TableHead className="text-right">Consumo</TableHead>
                <TableHead className="text-right">Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDate(r.date)}</TableCell>
                  <TableCell className="font-mono">{r.plate}</TableCell>
                  <TableCell>{r.driver}</TableCell>
                  <TableCell className="max-w-[240px] truncate">{r.destination}</TableCell>
                  <TableCell className="text-right">{r.km.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{r.liters.toFixed(1)}</TableCell>
                  <TableCell className="text-right font-semibold">{r.kml.toFixed(1)} km/L</TableCell>
                  <TableCell className="text-right">{currency(r.cost)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Maintenance Tab ----------

function MaintenanceTab({
  maintenances, vehicles, isGestor,
}: { maintenances: Maintenance[]; vehicles: Vehicle[]; isGestor: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    vehicle_id: "",
    type: "preventiva" as Maintenance["type"],
    description: "",
    date: new Date().toISOString().slice(0, 10),
    cost: 0,
    odometer: 0,
    status: "agendada" as Maintenance["status"],
    km_interval: 10000,
    months_interval: 6,
    last_done_at: "",
    last_done_km: 0,
  });

  const alerts = computeAllAlerts(maintenances, vehicles);
  const alertMap = new Map(alerts.map((a) => [a.maintenance.id, a]));

  const createM = useMutation({
    mutationFn: () => createMaintenance({
      data: {
        vehicle_id: form.vehicle_id,
        type: form.type,
        description: form.description,
        date: new Date(form.date).toISOString(),
        cost: form.cost,
        odometer: form.odometer,
        status: form.status,
        km_interval: form.km_interval || null,
        months_interval: form.months_interval || null,
        last_done_at: form.last_done_at ? new Date(form.last_done_at).toISOString() : null,
        last_done_km: form.last_done_km || null,
      },
    }),
    onSuccess: () => {
      toast.success("Manutenção registrada");
      qc.invalidateQueries({ queryKey: ["maintenances"] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const completeM = useMutation({
    mutationFn: (id: string) => completeMaintenance({
      data: { id, done_at: new Date().toISOString(), done_km: vehicles.find((v) => v.id === maintenances.find((m) => m.id === id)?.vehicle_id)?.odometer ?? 0 },
    }),
    onSuccess: () => {
      toast.success("Manutenção concluída");
      qc.invalidateQueries({ queryKey: ["maintenances"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Manutenções</CardTitle>
            <CardDescription>Agendadas, concluídas e alertas por km/tempo</CardDescription>
          </div>
          {isGestor && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Nova manutenção</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Registrar manutenção</DialogTitle>
                  <DialogDescription>Defina intervalos para receber alertas automáticos</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2"><Label>Veículo</Label>
                      <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {vehicles.map((v) => (<SelectItem key={v.id} value={v.id}>{v.plate} — {v.model}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2"><Label>Tipo</Label>
                      <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Maintenance["type"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(MAINT_TYPE_LABEL).map(([k, l]) => (
                            <SelectItem key={k} value={k}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2"><Label>Descrição</Label>
                    <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="grid gap-2"><Label>Data</Label>
                      <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                    </div>
                    <div className="grid gap-2"><Label>Custo (R$)</Label>
                      <Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} />
                    </div>
                    <div className="grid gap-2"><Label>KM</Label>
                      <Input type="number" value={form.odometer} onChange={(e) => setForm({ ...form, odometer: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2"><Label>Status</Label>
                      <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Maintenance["status"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="agendada">Agendada</SelectItem>
                          <SelectItem value="concluida">Concluída</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <div className="text-sm font-semibold mb-2">Alertas automáticos</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2"><Label>A cada (km)</Label>
                        <Input type="number" value={form.km_interval} onChange={(e) => setForm({ ...form, km_interval: Number(e.target.value) })} placeholder="Ex.: 10000" />
                      </div>
                      <div className="grid gap-2"><Label>A cada (meses)</Label>
                        <Input type="number" value={form.months_interval} onChange={(e) => setForm({ ...form, months_interval: Number(e.target.value) })} placeholder="Ex.: 6" />
                      </div>
                      <div className="grid gap-2"><Label>Última realização</Label>
                        <Input type="date" value={form.last_done_at} onChange={(e) => setForm({ ...form, last_done_at: e.target.value })} />
                      </div>
                      <div className="grid gap-2"><Label>KM na última</Label>
                        <Input type="number" value={form.last_done_km} onChange={(e) => setForm({ ...form, last_done_km: Number(e.target.value) })} />
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => {
                    if (!form.vehicle_id || !form.description) return toast.error("Preencha veículo e descrição");
                    createM.mutate();
                  }} disabled={createM.isPending}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {maintenances.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma manutenção registrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maintenances.map((m) => {
                  const v = vehicles.find((x) => x.id === m.vehicle_id);
                  const a = alertMap.get(m.id);
                  return (
                    <TableRow key={m.id} className={a?.status === "vencida" ? "bg-red-50" : a?.status === "proxima" ? "bg-amber-50" : ""}>
                      <TableCell className="font-mono">{v?.plate ?? "?"}</TableCell>
                      <TableCell>{MAINT_TYPE_LABEL[m.type]}</TableCell>
                      <TableCell className="max-w-[280px]">
                        {m.description}
                        {a && (
                          <div className="text-xs mt-1 flex items-center gap-1">
                            <AlertTriangle className={`h-3 w-3 ${a.status === "vencida" ? "text-red-600" : "text-amber-600"}`} />
                            <span className={a.status === "vencida" ? "text-red-700" : "text-amber-700"}>{a.reason}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(m.date)}</TableCell>
                      <TableCell className="text-right">{currency(Number(m.cost))}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={m.status === "concluida" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-blue-100 text-blue-800 border-blue-200"}>
                          {m.status === "concluida" ? "Concluída" : "Agendada"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isGestor && m.status === "agendada" && (
                          <Button size="sm" variant="outline" onClick={() => completeM.mutate(m.id)} disabled={completeM.isPending}>
                            <CheckCircle2 className="mr-1 h-3 w-3" />Concluir
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Reports Tab ----------

function ReportsTab({ trips, maintenances, vehicles }: { trips: Trip[]; maintenances: Maintenance[]; vehicles: Vehicle[] }) {
  const [range, setRange] = useState<"3" | "6" | "12">("6");
  const cutoff = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - Number(range));
    return d.getTime();
  }, [range]);

  const filteredTrips = trips.filter((t) => new Date(t.ended_at ?? t.started_at).getTime() >= cutoff);
  const filteredMaint = maintenances.filter((m) => new Date(m.date).getTime() >= cutoff);

  // Consumo por veículo (km/L)
  const consumptionByVehicle = vehicles.map((v) => {
    const vtrips = filteredTrips.filter((t) => t.vehicle_id === v.id && t.fuel_liters && t.end_km);
    const km = vtrips.reduce((a, t) => a + ((t.end_km ?? 0) - t.start_km), 0);
    const l = vtrips.reduce((a, t) => a + Number(t.fuel_liters ?? 0), 0);
    return { name: v.plate, kml: l > 0 ? Number((km / l).toFixed(2)) : 0, custo: vtrips.reduce((a, t) => a + Number(t.fuel_cost ?? 0), 0) };
  }).filter((r) => r.kml > 0 || r.custo > 0);

  // Combustível por mês
  const fuelByMonth: Record<string, { month: string; custo: number; litros: number }> = {};
  for (const t of filteredTrips) {
    if (!t.ended_at) continue;
    const k = monthKey(t.ended_at);
    if (!fuelByMonth[k]) fuelByMonth[k] = { month: k, custo: 0, litros: 0 };
    fuelByMonth[k].custo += Number(t.fuel_cost ?? 0);
    fuelByMonth[k].litros += Number(t.fuel_liters ?? 0);
  }
  const fuelSeries = Object.values(fuelByMonth).sort((a, b) => a.month.localeCompare(b.month));

  // Manutenção por mês (custo)
  const maintByMonth: Record<string, { month: string; custo: number; qtd: number }> = {};
  for (const m of filteredMaint) {
    const k = monthKey(m.date);
    if (!maintByMonth[k]) maintByMonth[k] = { month: k, custo: 0, qtd: 0 };
    maintByMonth[k].custo += Number(m.cost);
    maintByMonth[k].qtd += 1;
  }
  const maintSeries = Object.values(maintByMonth).sort((a, b) => a.month.localeCompare(b.month));

  // Manutenção por veículo
  const maintByVehicle = vehicles.map((v) => {
    const items = filteredMaint.filter((m) => m.vehicle_id === v.id);
    return {
      name: v.plate,
      custo: items.reduce((a, m) => a + Number(m.cost), 0),
      qtd: items.length,
    };
  }).filter((r) => r.custo > 0);

  const totalFuel = fuelSeries.reduce((a, r) => a + r.custo, 0);
  const totalMaint = maintSeries.reduce((a, r) => a + r.custo, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Relatórios</CardTitle>
            <CardDescription>Consumo e manutenções por período</CardDescription>
          </div>
          <Select value={range} onValueChange={(v) => setRange(v as "3" | "6" | "12")}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Últimos 12 meses</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <StatCard icon={<Fuel className="h-4 w-4" />} label="Combustível" value={currency(totalFuel)} hint={`${filteredTrips.length} trajetos`} />
            <StatCard icon={<Wrench className="h-4 w-4" />} label="Manutenções" value={currency(totalMaint)} hint={`${filteredMaint.length} registros`} />
            <StatCard icon={<Truck className="h-4 w-4" />} label="Frota ativa" value={String(vehicles.length)} hint="Veículos cadastrados" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consumo médio por veículo (km/L)</CardTitle>
          </CardHeader>
          <CardContent>
            {consumptionByVehicle.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={consumptionByVehicle}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="kml" name="km/L" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Custo de combustível por mês</CardTitle>
          </CardHeader>
          <CardContent>
            {fuelSeries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={fuelSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(v: number) => currency(v)} />
                  <Line type="monotone" dataKey="custo" name="Custo" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Custo de manutenção por veículo</CardTitle>
          </CardHeader>
          <CardContent>
            {maintByVehicle.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={maintByVehicle}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(v: number) => currency(v)} />
                  <Bar dataKey="custo" name="Custo" fill="hsl(var(--chart-2, 173 58% 39%))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manutenções por mês</CardTitle>
          </CardHeader>
          <CardContent>
            {maintSeries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={maintSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="qtd" name="Qtd" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="custo" name="Custo (R$)" fill="hsl(var(--chart-3, 43 74% 66%))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
