import { useEffect, useState } from "react";

export type Vehicle = {
  id: string;
  plate: string;
  model: string;
  year: number;
  odometer: number; // km
  status: "disponivel" | "em_uso" | "manutencao";
  fuelType: "gasolina" | "diesel" | "etanol" | "flex";
};

export type ChecklistItem =
  | "pneus"
  | "freios"
  | "luzes"
  | "oleo"
  | "agua"
  | "documentos"
  | "cintos"
  | "extintor";

export const CHECKLIST_LABELS: Record<ChecklistItem, string> = {
  pneus: "Pneus (calibragem e estado)",
  freios: "Freios",
  luzes: "Luzes e setas",
  oleo: "Nível de óleo",
  agua: "Água do radiador",
  documentos: "Documentos do veículo",
  cintos: "Cintos de segurança",
  extintor: "Extintor de incêndio",
};

export type Trip = {
  id: string;
  vehicleId: string;
  driver: string;
  destination: string;
  startedAt: string;
  endedAt?: string;
  startKm: number;
  endKm?: number;
  fuelLiters?: number;
  fuelCost?: number;
  checklist: Record<ChecklistItem, boolean>;
  notes?: string;
};

export type Maintenance = {
  id: string;
  vehicleId: string;
  type: "preventiva" | "corretiva" | "revisao" | "troca_oleo" | "pneus";
  description: string;
  date: string;
  cost: number;
  odometer: number;
  status: "agendada" | "concluida";
};

type Store = {
  vehicles: Vehicle[];
  trips: Trip[];
  maintenances: Maintenance[];
};

const KEY = "frota-store-v1";

const seed: Store = {
  vehicles: [
    { id: "v1", plate: "BRA2E19", model: "Fiat Strada", year: 2022, odometer: 48210, status: "disponivel", fuelType: "flex" },
    { id: "v2", plate: "RIO1A23", model: "VW Delivery 9.170", year: 2020, odometer: 132540, status: "em_uso", fuelType: "diesel" },
    { id: "v3", plate: "SPO7K88", model: "Renault Kangoo", year: 2021, odometer: 76890, status: "manutencao", fuelType: "flex" },
    { id: "v4", plate: "MGH3L45", model: "Mercedes Sprinter", year: 2023, odometer: 22110, status: "disponivel", fuelType: "diesel" },
  ],
  trips: [
    {
      id: "t1", vehicleId: "v2", driver: "Carlos Silva", destination: "Centro de Distribuição - Guarulhos",
      startedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      endedAt: new Date(Date.now() - 86400000 * 2 + 3600000 * 5).toISOString(),
      startKm: 132200, endKm: 132540, fuelLiters: 62, fuelCost: 384.4,
      checklist: { pneus: true, freios: true, luzes: true, oleo: true, agua: true, documentos: true, cintos: true, extintor: true },
    },
    {
      id: "t2", vehicleId: "v1", driver: "Ana Costa", destination: "Cliente - Campinas",
      startedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      endedAt: new Date(Date.now() - 86400000 * 5 + 3600000 * 4).toISOString(),
      startKm: 47950, endKm: 48210, fuelLiters: 28, fuelCost: 168,
      checklist: { pneus: true, freios: true, luzes: true, oleo: true, agua: true, documentos: true, cintos: true, extintor: true },
    },
  ],
  maintenances: [
    { id: "m1", vehicleId: "v3", type: "corretiva", description: "Troca de embreagem", date: new Date(Date.now() - 86400000 * 3).toISOString(), cost: 2400, odometer: 76500, status: "concluida" },
    { id: "m2", vehicleId: "v1", type: "troca_oleo", description: "Troca de óleo e filtros", date: new Date(Date.now() + 86400000 * 7).toISOString(), cost: 380, odometer: 50000, status: "agendada" },
    { id: "m3", vehicleId: "v2", type: "revisao", description: "Revisão dos 130 mil km", date: new Date(Date.now() - 86400000 * 15).toISOString(), cost: 1850, odometer: 130000, status: "concluida" },
  ],
};

function load(): Store {
  if (typeof window === "undefined") return seed;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed;
    return JSON.parse(raw) as Store;
  } catch {
    return seed;
  }
}

function save(s: Store) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

let memory: Store | null = null;
const listeners = new Set<() => void>();

function getStore(): Store {
  if (!memory) memory = load();
  return memory;
}

function setStore(updater: (s: Store) => Store) {
  memory = updater(getStore());
  save(memory);
  listeners.forEach((l) => l());
}

export function useFleet() {
  const [, setTick] = useState(0);
  useEffect(() => {
    // hydrate from localStorage on client
    memory = load();
    setTick((t) => t + 1);
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const store = getStore();
  return {
    ...store,
    addVehicle: (v: Omit<Vehicle, "id">) =>
      setStore((s) => ({ ...s, vehicles: [...s.vehicles, { ...v, id: crypto.randomUUID() }] })),
    startTrip: (t: Omit<Trip, "id" | "startedAt">) =>
      setStore((s) => ({
        ...s,
        trips: [{ ...t, id: crypto.randomUUID(), startedAt: new Date().toISOString() }, ...s.trips],
        vehicles: s.vehicles.map((v) => (v.id === t.vehicleId ? { ...v, status: "em_uso" } : v)),
      })),
    endTrip: (id: string, data: { endKm: number; fuelLiters: number; fuelCost: number; notes?: string }) =>
      setStore((s) => {
        const trip = s.trips.find((t) => t.id === id);
        return {
          ...s,
          trips: s.trips.map((t) => (t.id === id ? { ...t, ...data, endedAt: new Date().toISOString() } : t)),
          vehicles: s.vehicles.map((v) =>
            trip && v.id === trip.vehicleId ? { ...v, status: "disponivel", odometer: data.endKm } : v,
          ),
        };
      }),
    addMaintenance: (m: Omit<Maintenance, "id">) =>
      setStore((s) => ({
        ...s,
        maintenances: [{ ...m, id: crypto.randomUUID() }, ...s.maintenances],
        vehicles:
          m.status === "agendada"
            ? s.vehicles
            : s.vehicles.map((v) => (v.id === m.vehicleId ? { ...v, status: "disponivel" } : v)),
      })),
    completeMaintenance: (id: string) =>
      setStore((s) => ({
        ...s,
        maintenances: s.maintenances.map((m) => (m.id === id ? { ...m, status: "concluida" } : m)),
      })),
  };
}
