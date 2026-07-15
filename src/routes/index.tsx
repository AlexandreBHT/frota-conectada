import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Truck,
  ClipboardCheck,
  Fuel,
  Wrench,
  Plus,
  Play,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Gauge,
  TrendingDown,
} from "lucide-react";
import { Toaster } from "sonner";
import { toast } from "sonner";
import {
  useFleet,
  CHECKLIST_LABELS,
  type ChecklistItem,
  type Vehicle,
  type Maintenance,
} from "@/lib/fleet-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/")({
  component: FleetDashboard,
});

const STATUS_LABEL: Record<Vehicle["status"], string> = {
  disponivel: "Disponível",
  em_uso: "Em uso",
  manutencao: "Manutenção",
};

const STATUS_STYLES: Record<Vehicle["status"], string> = {
  disponivel: "bg-emerald-100 text-emerald-800 border-emerald-200",
  em_uso: "bg-blue-100 text-blue-800 border-blue-200",
  manutencao: "bg-amber-100 text-amber-900 border-amber-200",
};

const MAINT_TYPE_LABEL: Record<Maintenance["type"], string> = {
  preventiva: "Preventiva",
  corretiva: "Corretiva",
  revisao: "Revisão",
  troca_oleo: "Troca de óleo",
  pneus: "Pneus",
};

function currency(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function FleetDashboard() {
  const fleet = useFleet();
  const [tab, setTab] = useState("overview");

  const activeTrips = fleet.trips.filter((t) => !t.endedAt);
  const completedTrips = fleet.trips.filter((t) => t.endedAt);

  const totalKm = completedTrips.reduce((acc, t) => acc + ((t.endKm ?? 0) - t.startKm), 0);
  const totalLiters = completedTrips.reduce((acc, t) => acc + (t.fuelLiters ?? 0), 0);
  const totalFuelCost = completedTrips.reduce((acc, t) => acc + (t.fuelCost ?? 0), 0);
  const avgConsumption = totalLiters > 0 ? totalKm / totalLiters : 0;

  const upcomingMaintenances = fleet.maintenances.filter((m) => m.status === "agendada");
  const maintenanceCost = fleet.maintenances
    .filter((m) => m.status === "concluida")
    .reduce((a, m) => a + m.cost, 0);

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
              <p className="text-xs text-muted-foreground">Gestão inteligente da sua frota</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <StatCard icon={<Truck className="h-4 w-4" />} label="Veículos" value={String(fleet.vehicles.length)} hint={`${fleet.vehicles.filter(v => v.status === "disponivel").length} disponíveis`} />
          <StatCard icon={<Play className="h-4 w-4" />} label="Trajetos ativos" value={String(activeTrips.length)} hint={`${completedTrips.length} concluídos`} />
          <StatCard icon={<Fuel className="h-4 w-4" />} label="Consumo médio" value={`${avgConsumption.toFixed(1)} km/L`} hint={`${totalLiters.toFixed(0)} L consumidos`} />
          <StatCard icon={<Wrench className="h-4 w-4" />} label="Manutenções" value={String(upcomingMaintenances.length)} hint={`${currency(maintenanceCost)} gastos`} />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview"><Truck className="mr-2 h-4 w-4" />Veículos</TabsTrigger>
            <TabsTrigger value="checklist"><ClipboardCheck className="mr-2 h-4 w-4" />Iniciar Trajeto</TabsTrigger>
            <TabsTrigger value="fuel"><Fuel className="mr-2 h-4 w-4" />Consumo</TabsTrigger>
            <TabsTrigger value="maintenance"><Wrench className="mr-2 h-4 w-4" />Manutenções</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <VehiclesTab />
          </TabsContent>
          <TabsContent value="checklist">
            <ChecklistTab onDone={() => setTab("fuel")} />
          </TabsContent>
          <TabsContent value="fuel">
            <FuelTab />
          </TabsContent>
          <TabsContent value="maintenance">
            <MaintenanceTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {icon}
          {label}
        </div>
        <div className="mt-3 text-2xl font-bold tracking-tight">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{hint}</div>
      </CardContent>
    </Card>
  );
}

function VehiclesTab() {
  const fleet = useFleet();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ plate: "", model: "", year: 2024, odometer: 0, fuelType: "flex" as Vehicle["fuelType"] });

  const submit = () => {
    if (!form.plate || !form.model) return toast.error("Preencha placa e modelo");
    fleet.addVehicle({ ...form, status: "disponivel" });
    toast.success("Veículo adicionado");
    setOpen(false);
    setForm({ plate: "", model: "", year: 2024, odometer: 0, fuelType: "flex" });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Frota</CardTitle>
          <CardDescription>Todos os veículos cadastrados</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Novo veículo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar veículo</DialogTitle>
              <DialogDescription>Adicione um novo veículo à frota</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Placa</Label>
                <Input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })} placeholder="ABC1D23" />
              </div>
              <div className="grid gap-2">
                <Label>Modelo</Label>
                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Fiat Fiorino" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Ano</Label>
                  <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
                </div>
                <div className="grid gap-2">
                  <Label>KM atual</Label>
                  <Input type="number" value={form.odometer} onChange={(e) => setForm({ ...form, odometer: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Combustível</Label>
                <Select value={form.fuelType} onValueChange={(v) => setForm({ ...form, fuelType: v as Vehicle["fuelType"] })}>
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
              <Button onClick={submit}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {fleet.vehicles.map((v) => (
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
                <div className="col-span-2"><span className="text-muted-foreground">Combustível:</span> <span className="font-medium capitalize">{v.fuelType}</span></div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const CHECKLIST_KEYS = Object.keys(CHECKLIST_LABELS) as ChecklistItem[];
const emptyChecklist = () =>
  CHECKLIST_KEYS.reduce((acc, k) => ({ ...acc, [k]: false }), {} as Record<ChecklistItem, boolean>);

function ChecklistTab({ onDone }: { onDone: () => void }) {
  const fleet = useFleet();
  const [vehicleId, setVehicleId] = useState("");
  const [driver, setDriver] = useState("");
  const [destination, setDestination] = useState("");
  const [checklist, setChecklist] = useState<Record<ChecklistItem, boolean>>(emptyChecklist());
  const [notes, setNotes] = useState("");

  const activeTrips = fleet.trips.filter((t) => !t.endedAt);
  const available = fleet.vehicles.filter((v) => v.status === "disponivel");

  const allChecked = CHECKLIST_KEYS.every((k) => checklist[k]);
  const selectedVehicle = fleet.vehicles.find((v) => v.id === vehicleId);

  const start = () => {
    if (!vehicleId) return toast.error("Selecione um veículo");
    if (!driver) return toast.error("Informe o motorista");
    if (!destination) return toast.error("Informe o destino");
    if (!allChecked) return toast.error("Complete o checklist antes de iniciar");

    fleet.startTrip({
      vehicleId,
      driver,
      destination,
      startKm: selectedVehicle?.odometer ?? 0,
      checklist,
      notes: notes || undefined,
    });
    toast.success("Trajeto iniciado! Boa viagem 🚛");
    setVehicleId(""); setDriver(""); setDestination(""); setChecklist(emptyChecklist()); setNotes("");
  };

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
                  {available.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.plate} — {v.model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Motorista</Label>
              <Input value={driver} onChange={(e) => setDriver(e.target.value)} placeholder="Nome do motorista" />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Destino</Label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Ex.: Cliente X - São Paulo/SP" />
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Itens de segurança</h3>
              <span className="text-xs text-muted-foreground">
                {CHECKLIST_KEYS.filter((k) => checklist[k]).length}/{CHECKLIST_KEYS.length}
              </span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {CHECKLIST_KEYS.map((k) => (
                <label key={k} className="flex items-center gap-3 rounded-md border bg-card p-3 hover:bg-accent cursor-pointer">
                  <Checkbox
                    checked={checklist[k]}
                    onCheckedChange={(v) => setChecklist({ ...checklist, [k]: Boolean(v) })}
                  />
                  <span className="text-sm">{CHECKLIST_LABELS[k]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Observações (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Alguma anomalia identificada?" rows={2} />
          </div>

          <Button size="lg" className="w-full" onClick={start} disabled={!allChecked || !vehicleId}>
            <Play className="mr-2 h-4 w-4" />
            Iniciar trajeto
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trajetos em andamento</CardTitle>
          <CardDescription>Encerre para registrar consumo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeTrips.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum trajeto ativo.</p>
          )}
          {activeTrips.map((t) => {
            const v = fleet.vehicles.find((x) => x.id === t.vehicleId);
            return <ActiveTripCard key={t.id} tripId={t.id} plate={v?.plate ?? ""} driver={t.driver} destination={t.destination} startKm={t.startKm} onEnd={onDone} />;
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function ActiveTripCard({ tripId, plate, driver, destination, startKm, onEnd }: { tripId: string; plate: string; driver: string; destination: string; startKm: number; onEnd: () => void }) {
  const fleet = useFleet();
  const [open, setOpen] = useState(false);
  const [endKm, setEndKm] = useState(startKm);
  const [liters, setLiters] = useState(0);
  const [cost, setCost] = useState(0);

  const end = () => {
    if (endKm <= startKm) return toast.error("KM final deve ser maior que o inicial");
    fleet.endTrip(tripId, { endKm, fuelLiters: liters, fuelCost: cost });
    toast.success("Trajeto encerrado");
    setOpen(false);
    onEnd();
  };

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-bold">{plate}</span>
        <Badge className="bg-blue-100 text-blue-800 border-blue-200" variant="outline">Em rota</Badge>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">{driver}</div>
      <div className="text-xs mt-1">{destination}</div>
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
              <Label>KM final (inicial: {startKm.toLocaleString("pt-BR")})</Label>
              <Input type="number" value={endKm} onChange={(e) => setEndKm(Number(e.target.value))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Litros abastecidos</Label>
                <Input type="number" step="0.01" value={liters} onChange={(e) => setLiters(Number(e.target.value))} />
              </div>
              <div className="grid gap-2">
                <Label>Custo (R$)</Label>
                <Input type="number" step="0.01" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={end}>Encerrar trajeto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FuelTab() {
  const fleet = useFleet();
  const completed = fleet.trips.filter((t) => t.endedAt && t.endKm && t.fuelLiters);

  const byVehicle = useMemo(() => {
    const map = new Map<string, { km: number; liters: number; cost: number; trips: number }>();
    for (const t of completed) {
      const km = (t.endKm ?? 0) - t.startKm;
      const cur = map.get(t.vehicleId) ?? { km: 0, liters: 0, cost: 0, trips: 0 };
      cur.km += km;
      cur.liters += t.fuelLiters ?? 0;
      cur.cost += t.fuelCost ?? 0;
      cur.trips += 1;
      map.set(t.vehicleId, cur);
    }
    return map;
  }, [completed]);

  const totalKm = completed.reduce((a, t) => a + ((t.endKm ?? 0) - t.startKm), 0);
  const totalLiters = completed.reduce((a, t) => a + (t.fuelLiters ?? 0), 0);
  const totalCost = completed.reduce((a, t) => a + (t.fuelCost ?? 0), 0);
  const costPerKm = totalKm > 0 ? totalCost / totalKm : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Gauge className="h-4 w-4" />Distância total
            </div>
            <div className="mt-3 text-2xl font-bold">{totalKm.toLocaleString("pt-BR")} km</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Fuel className="h-4 w-4" />Combustível
            </div>
            <div className="mt-3 text-2xl font-bold">{totalLiters.toFixed(1)} L</div>
            <div className="text-xs text-muted-foreground mt-1">{currency(totalCost)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <TrendingDown className="h-4 w-4" />Custo por km
            </div>
            <div className="mt-3 text-2xl font-bold">{currency(costPerKm)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Consumo por veículo</CardTitle>
          <CardDescription>Média baseada nos trajetos concluídos</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Veículo</TableHead>
                <TableHead className="text-right">Trajetos</TableHead>
                <TableHead className="text-right">KM</TableHead>
                <TableHead className="text-right">Litros</TableHead>
                <TableHead className="text-right">Consumo</TableHead>
                <TableHead className="text-right">Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fleet.vehicles.map((v) => {
                const s = byVehicle.get(v.id);
                if (!s) return null;
                const cons = s.liters > 0 ? s.km / s.liters : 0;
                return (
                  <TableRow key={v.id}>
                    <TableCell>
                      <div className="font-mono text-xs font-bold">{v.plate}</div>
                      <div className="text-xs text-muted-foreground">{v.model}</div>
                    </TableCell>
                    <TableCell className="text-right">{s.trips}</TableCell>
                    <TableCell className="text-right">{s.km.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right">{s.liters.toFixed(1)}</TableCell>
                    <TableCell className="text-right font-semibold">{cons.toFixed(2)} km/L</TableCell>
                    <TableCell className="text-right">{currency(s.cost)}</TableCell>
                  </TableRow>
                );
              })}
              {byVehicle.size === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    Encerre um trajeto para registrar consumo.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de abastecimentos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead className="text-right">KM</TableHead>
                <TableHead className="text-right">Litros</TableHead>
                <TableHead className="text-right">R$/L</TableHead>
                <TableHead className="text-right">Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completed.map((t) => {
                const v = fleet.vehicles.find((x) => x.id === t.vehicleId);
                const km = (t.endKm ?? 0) - t.startKm;
                const pricePerL = (t.fuelLiters ?? 0) > 0 ? (t.fuelCost ?? 0) / (t.fuelLiters ?? 1) : 0;
                return (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs">{formatDate(t.endedAt!)}</TableCell>
                    <TableCell className="font-mono text-xs">{v?.plate}</TableCell>
                    <TableCell className="text-xs">{t.driver}</TableCell>
                    <TableCell className="text-right text-xs">{km.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right text-xs">{t.fuelLiters?.toFixed(1)}</TableCell>
                    <TableCell className="text-right text-xs">{currency(pricePerL)}</TableCell>
                    <TableCell className="text-right text-xs font-semibold">{currency(t.fuelCost ?? 0)}</TableCell>
                  </TableRow>
                );
              })}
              {completed.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                    Nenhum abastecimento registrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MaintenanceTab() {
  const fleet = useFleet();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    vehicleId: "",
    type: "preventiva" as Maintenance["type"],
    description: "",
    date: new Date().toISOString().slice(0, 10),
    cost: 0,
    odometer: 0,
    status: "agendada" as Maintenance["status"],
  });

  const submit = () => {
    if (!form.vehicleId || !form.description) return toast.error("Preencha veículo e descrição");
    fleet.addMaintenance({ ...form, date: new Date(form.date).toISOString() });
    toast.success("Manutenção registrada");
    setOpen(false);
    setForm({ vehicleId: "", type: "preventiva", description: "", date: new Date().toISOString().slice(0, 10), cost: 0, odometer: 0, status: "agendada" });
  };

  const upcoming = fleet.maintenances.filter((m) => m.status === "agendada").sort((a, b) => a.date.localeCompare(b.date));
  const history = fleet.maintenances.filter((m) => m.status === "concluida").sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" />Agendadas</CardTitle>
            <CardDescription>Manutenções previstas ou em andamento</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Nova manutenção</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar manutenção</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Veículo</Label>
                  <Select value={form.vehicleId} onValueChange={(v) => setForm({ ...form, vehicleId: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {fleet.vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.plate} — {v.model}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Tipo</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Maintenance["type"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="preventiva">Preventiva</SelectItem>
                        <SelectItem value="corretiva">Corretiva</SelectItem>
                        <SelectItem value="revisao">Revisão</SelectItem>
                        <SelectItem value="troca_oleo">Troca de óleo</SelectItem>
                        <SelectItem value="pneus">Pneus</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Maintenance["status"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="agendada">Agendada</SelectItem>
                        <SelectItem value="concluida">Concluída</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Descrição</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex.: Troca de pastilhas de freio dianteiras" rows={2} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label>Data</Label>
                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>KM</Label>
                    <Input type="number" value={form.odometer} onChange={(e) => setForm({ ...form, odometer: Number(e.target.value) })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Custo (R$)</Label>
                    <Input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={submit}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma manutenção agendada.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {upcoming.map((m) => {
                const v = fleet.vehicles.find((x) => x.id === m.vehicleId);
                return (
                  <div key={m.id} className="rounded-lg border-l-4 border-l-amber-500 border bg-card p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-mono text-xs font-bold">{v?.plate}</div>
                        <div className="text-sm font-medium mt-1">{m.description}</div>
                      </div>
                      <Badge variant="outline">{MAINT_TYPE_LABEL[m.type]}</Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDate(m.date)} • {m.odometer.toLocaleString("pt-BR")} km</span>
                      <span className="font-semibold text-foreground">{currency(m.cost)}</span>
                    </div>
                    <Button size="sm" variant="outline" className="w-full mt-3" onClick={() => { fleet.completeMaintenance(m.id); toast.success("Manutenção concluída"); }}>
                      <CheckCircle2 className="mr-2 h-3 w-3" />Marcar como concluída
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
          <CardDescription>Manutenções concluídas — total: {currency(history.reduce((a, m) => a + m.cost, 0))}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">KM</TableHead>
                <TableHead className="text-right">Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((m) => {
                const v = fleet.vehicles.find((x) => x.id === m.vehicleId);
                return (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">{formatDate(m.date)}</TableCell>
                    <TableCell className="font-mono text-xs">{v?.plate}</TableCell>
                    <TableCell className="text-xs">{MAINT_TYPE_LABEL[m.type]}</TableCell>
                    <TableCell className="text-xs">{m.description}</TableCell>
                    <TableCell className="text-right text-xs">{m.odometer.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right text-xs font-semibold">{currency(m.cost)}</TableCell>
                  </TableRow>
                );
              })}
              {history.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    Nenhuma manutenção concluída.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
