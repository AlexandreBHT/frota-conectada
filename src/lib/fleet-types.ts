export type VehicleStatus = "disponivel" | "em_uso" | "manutencao";
export type FuelType = "gasolina" | "diesel" | "etanol" | "flex";
export type VehicleType = "caminhao" | "caminhao_munck" | "bongo" | "utilitario";
export type MaintType = "preventiva" | "corretiva" | "revisao" | "troca_oleo" | "pneus";
export type MaintStatus = "agendada" | "concluida";
export type AppRole = "gestor" | "motorista";

export type ChecklistItem =
  | "pneus" | "freios" | "luzes" | "oleo" | "agua" | "documentos" | "cintos" | "extintor";

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

export const CHECKLIST_KEYS = Object.keys(CHECKLIST_LABELS) as ChecklistItem[];

export type Vehicle = {
  id: string;
  plate: string;
  model: string;
  year: number;
  odometer: number;
  status: VehicleStatus;
  fuel_type: FuelType;
  vehicle_type: VehicleType;
  max_load_kg: number;
  created_at: string;
};

export type Trip = {
  id: string;
  vehicle_id: string;
  driver_id: string;
  driver_name: string;
  destination: string;
  started_at: string;
  ended_at: string | null;
  start_km: number;
  end_km: number | null;
  fuel_liters: number | null;
  fuel_cost: number | null;
  checklist: Record<string, boolean>;
  notes: string | null;
};

export type Maintenance = {
  id: string;
  vehicle_id: string;
  type: MaintType;
  description: string;
  date: string;
  cost: number;
  odometer: number;
  status: MaintStatus;
  km_interval: number | null;
  months_interval: number | null;
  last_done_at: string | null;
  last_done_km: number | null;
};

export type Me = {
  userId: string;
  email: string;
  fullName: string | null;
  role: AppRole;
};

export const STATUS_LABEL: Record<VehicleStatus, string> = {
  disponivel: "Disponível",
  em_uso: "Em uso",
  manutencao: "Manutenção",
};

export const STATUS_STYLES: Record<VehicleStatus, string> = {
  disponivel: "bg-emerald-100 text-emerald-800 border-emerald-200",
  em_uso: "bg-blue-100 text-blue-800 border-blue-200",
  manutencao: "bg-amber-100 text-amber-900 border-amber-200",
};

export const MAINT_TYPE_LABEL: Record<MaintType, string> = {
  preventiva: "Preventiva",
  corretiva: "Corretiva",
  revisao: "Revisão",
  troca_oleo: "Troca de óleo",
  pneus: "Pneus",
};


export const VEHICLE_TYPE_LABEL: Record<VehicleType, string> = {
  caminhao: "Caminhão",
  caminhao_munck: "Caminhão com Munck",
  bongo: "Bongo",
  utilitario: "Utilitário",
};
