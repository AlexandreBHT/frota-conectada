import type { Maintenance, Vehicle } from "./fleet-types";

export type AlertStatus = "vencida" | "proxima" | "ok";

export type MaintenanceAlert = {
  maintenance: Maintenance;
  vehicle: Vehicle | undefined;
  status: AlertStatus;
  reason: string;
};

const KM_WARN = 500;
const DAYS_WARN = 15;
const MS_DAY = 86400000;

function rank(s: AlertStatus): number {
  return s === "vencida" ? 2 : s === "proxima" ? 1 : 0;
}

export function computeAlert(m: Maintenance, vehicle: Vehicle | undefined): MaintenanceAlert {
  if (m.status !== "agendada") return { maintenance: m, vehicle, status: "ok", reason: "" };

  const reasons: string[] = [];
  let worst: AlertStatus = "ok";
  const bump = (s: AlertStatus) => {
    if (rank(s) > rank(worst)) worst = s;
  };

  if (m.km_interval && m.last_done_km != null && vehicle) {
    const nextKm = m.last_done_km + m.km_interval;
    const remaining = nextKm - vehicle.odometer;
    if (remaining <= 0) {
      bump("vencida");
      reasons.push(`vencida há ${Math.abs(remaining).toLocaleString("pt-BR")} km`);
    } else if (remaining <= KM_WARN) {
      bump("proxima");
      reasons.push(`faltam ${remaining.toLocaleString("pt-BR")} km`);
    }
  }

  if (m.months_interval && m.last_done_at) {
    const last = new Date(m.last_done_at).getTime();
    const nextTs = last + m.months_interval * 30 * MS_DAY;
    const remainingDays = Math.floor((nextTs - Date.now()) / MS_DAY);
    if (remainingDays <= 0) {
      bump("vencida");
      reasons.push(`vencida há ${Math.abs(remainingDays)} dias`);
    } else if (remainingDays <= DAYS_WARN) {
      bump("proxima");
      reasons.push(`vence em ${remainingDays} dias`);
    }
  }

  if (!m.km_interval && !m.months_interval) {
    const d = new Date(m.date).getTime();
    const days = Math.floor((d - Date.now()) / MS_DAY);
    if (days < 0) {
      bump("vencida");
      reasons.push(`agendada há ${Math.abs(days)} dias`);
    } else if (days <= DAYS_WARN) {
      bump("proxima");
      reasons.push(`agendada em ${days} dias`);
    }
  }

  return { maintenance: m, vehicle, status: worst, reason: reasons.join(" · ") };
}

export function computeAllAlerts(maintenances: Maintenance[], vehicles: Vehicle[]): MaintenanceAlert[] {
  const byId = new Map(vehicles.map((v) => [v.id, v]));
  return maintenances
    .map((m) => computeAlert(m, byId.get(m.vehicle_id)))
    .filter((a) => a.status !== "ok");
}
