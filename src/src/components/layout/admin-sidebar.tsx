import {
  BarChart3,
  Car,
  ClipboardCheck,
  Fuel,
  Gauge,
  LayoutDashboard,
  LogOut,
  Route,
  Settings,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type AdminSection =
  | "dashboard"
  | "active-trips"
  | "vehicles"
  | "drivers"
  | "maintenance"
  | "fuel"
  | "inspections"
  | "incidents"
  | "reports"
  | "users"
  | "settings";

type MenuItem = {
  value: AdminSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type AdminSidebarProps = {
  activeSection: AdminSection;
  userName?: string;
  userRole?: string;
  onSectionChange: (section: AdminSection) => void;
  onSignOut: () => void;
};

const menuGroups: Array<{
  label: string;
  items: MenuItem[];
}> = [
  {
    label: "Visão geral",
    items: [
      {
        value: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
      },
      {
        value: "active-trips",
        label: "Rotas ativas",
        icon: Route,
      },
    ],
  },
  {
    label: "Operação",
    items: [
      {
        value: "vehicles",
        label: "Veículos",
        icon: Car,
      },
      {
        value: "drivers",
        label: "Motoristas",
        icon: UserRound,
      },
      {
        value: "inspections",
        label: "Vistorias",
        icon: ClipboardCheck,
      },
      {
        value: "incidents",
        label: "Ocorrências",
        icon: TriangleAlert,
      },
    ],
  },
  {
    label: "Controle",
    items: [
      {
        value: "maintenance",
        label: "Manutenções",
        icon: Wrench,
      },
      {
        value: "fuel",
        label: "Abastecimentos",
        icon: Fuel,
      },
    ],
  },
  {
    label: "Gestão",
    items: [
      {
        value: "reports",
        label: "Relatórios",
        icon: BarChart3,
      },
      {
        value: "users",
        label: "Usuários e permissões",
        icon: Users,
      },
      {
        value: "settings",
        label: "Configurações",
        icon: Settings,
      },
    ],
  },
];

export function AdminSidebar({
  activeSection,
  userName = "Usuário",
  userRole = "Administrador",
  onSectionChange,
  onSignOut,
}: AdminSidebarProps) {
  return (
    <aside className="flex h-screen w-72 shrink-0 flex-col border-r bg-card">
      <div className="flex h-20 items-center gap-3 border-b px-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Gauge className="h-6 w-6" />
        </div>

        <div>
          <p className="font-semibold leading-none">FrotaControl</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Gestão de frota BHT
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
        {menuGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>

            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onSectionChange(item.value)}
                    className={[
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t p-4">
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-muted/60 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {userRole}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          className="w-full justify-start text-muted-foreground"
          onClick={onSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  );
}
