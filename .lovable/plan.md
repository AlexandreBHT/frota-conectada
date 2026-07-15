## Objetivo

Evoluir o FrotaControl com três frentes: (1) alertas de manutenção por km/data, (2) login de motoristas com dados no banco e separação por papel, (3) painel com gráficos de consumo e relatórios de manutenção por período.

## 1. Backend (Lovable Cloud)

Habilitar Lovable Cloud e criar as tabelas do domínio da frota, substituindo o `localStorage` atual.

**Tabelas (schema `public`):**
- `profiles` (id, full_name, created_at) — 1:1 com `auth.users`, criada por trigger no signup.
- `app_role` enum: `gestor`, `motorista`.
- `user_roles` (id, user_id, role) — separada de profiles, com função `has_role()` security definer.
- `vehicles` (id, plate, model, year, odometer, status, fuel_type, created_at).
- `trips` (id, vehicle_id, driver_id → auth.users, destination, started_at, ended_at, start_km, end_km, fuel_liters, fuel_cost, checklist jsonb, notes).
- `maintenances` (id, vehicle_id, type, description, date, cost, odometer, status, km_interval, months_interval, last_done_at, last_done_km) — os dois últimos permitem calcular vencimento.

**RLS:**
- `vehicles` / `maintenances`: SELECT/INSERT/UPDATE/DELETE apenas para `gestor`. Motorista tem SELECT em `vehicles`.
- `trips`: motorista faz SELECT/INSERT/UPDATE apenas onde `driver_id = auth.uid()`; gestor vê e edita todas.
- `profiles`: cada usuário lê/edita o próprio; gestor lê todos.
- `user_roles`: leitura própria; escrita só via função admin (gestor).

## 2. Autenticação

- Página `/auth` pública (email + senha, com opção de cadastro) usando o cliente Supabase do template.
- Layout `_authenticated` gerido pela integração já protege o restante do app.
- Ao cadastrar, trigger `handle_new_user` cria `profiles` e atribui papel `motorista` por padrão. Primeiro usuário do sistema recebe `gestor` (via seed/migração).
- Sign-out no header, com limpeza do cache do React Query.

## 3. Alertas de Manutenção

Cada manutenção agendada pode ter:
- `km_interval` (ex.: a cada 10.000 km desde `last_done_km`)
- `months_interval` (ex.: a cada 6 meses desde `last_done_at`)

Regra de alerta (cliente, derivada dos dados):
- **Vencida**: `odometer_atual >= last_done_km + km_interval` ou `hoje >= last_done_at + months_interval`.
- **Próxima**: faltando ≤ 500 km ou ≤ 15 dias.
- Banner no topo do dashboard + badge de contagem na aba "Manutenção" com lista destacada.

## 4. Painel de Gráficos e Relatórios

Nova aba **"Relatórios"** usando `recharts` (já disponível):
- **Consumo por veículo** (km/L médio) — bar chart.
- **Custo de combustível por mês** — line chart, com filtro mensal/trimestral.
- **Custo de manutenção por veículo** — bar chart empilhado (preventiva vs corretiva).
- **Manutenções por período** — tabela + gráfico mensal/trimestral, com totais.
- Seletor de período (últimos 3/6/12 meses) e exportação simples (CSV opcional).

## 5. Migração dos dados existentes

O `localStorage` atual será descontinuado. Na primeira execução após habilitar Cloud, se um `gestor` estiver logado e o banco estiver vazio, um botão "Importar dados locais" lê o `fleet-store-v1` e insere no banco. Depois disso, o `localStorage` deixa de ser usado.

## Arquivos afetados (Detalhes técnicos)

```text
src/
  integrations/supabase/          (gerado pela integração)
  routes/
    auth.tsx                       novo — login/cadastro
    _authenticated/
      route.tsx                    gerado pela integração
      index.tsx                    dashboard (movido de src/routes/index.tsx)
      reports.tsx                  novo — aba de relatórios (ou tab interna)
  lib/
    fleet-queries.ts               novo — queryOptions + servidor fns
    fleet-mutations.ts             novo — mutations React Query
    maintenance-alerts.ts          novo — derivação de status vencido/próximo
    fleet-store.ts                 removido após migração
  server/
    fleet.functions.ts             createServerFn com requireSupabaseAuth
```

- Leituras via `useSuspenseQuery` + loaders (`ensureQueryData`).
- Escritas via `useMutation` invalidando as queries relevantes.
- Toda regra de acesso vive nas policies; UI só esconde controles quando `!hasRole('gestor')`.

## Fora do escopo desta entrega

- Notificações por email dos alertas (podemos ligar depois via Lovable Email).
- Upload de fotos do checklist / documentos.
- Multi-tenant (várias empresas no mesmo banco).

Confirma que posso seguir? Assim que aprovar, habilito o Lovable Cloud e começo pelas migrações + auth, depois alertas e por fim o painel de relatórios.
