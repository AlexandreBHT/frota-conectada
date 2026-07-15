
-- Enums
CREATE TYPE public.app_role AS ENUM ('gestor', 'motorista');
CREATE TYPE public.vehicle_status AS ENUM ('disponivel', 'em_uso', 'manutencao');
CREATE TYPE public.fuel_type AS ENUM ('gasolina', 'diesel', 'etanol', 'flex');
CREATE TYPE public.maint_type AS ENUM ('preventiva', 'corretiva', 'revisao', 'troca_oleo', 'pneus');
CREATE TYPE public.maint_status AS ENUM ('agendada', 'concluida');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Handle new user: create profile + assign default role (first user = gestor)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email), NEW.email);

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_first THEN 'gestor'::public.app_role ELSE 'motorista'::public.app_role END);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Profile policies
CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- user_roles policies
CREATE POLICY "Users read own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Gestor manages roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));

-- Vehicles
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate TEXT NOT NULL UNIQUE,
  model TEXT NOT NULL,
  year INT NOT NULL,
  odometer INT NOT NULL DEFAULT 0,
  status public.vehicle_status NOT NULL DEFAULT 'disponivel',
  fuel_type public.fuel_type NOT NULL DEFAULT 'flex',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read vehicles"
  ON public.vehicles FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "Gestor writes vehicles"
  ON public.vehicles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Gestor updates vehicles"
  ON public.vehicles FOR UPDATE
  USING (public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Gestor deletes vehicles"
  ON public.vehicles FOR DELETE
  USING (public.has_role(auth.uid(), 'gestor'));
-- Also allow motorista to update odometer when finishing a trip via server fn (RLS: via service_role in server fn if needed, but here we allow authenticated to UPDATE odometer/status through end-trip flow)
CREATE POLICY "Driver updates vehicle status via trip"
  ON public.vehicles FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Trips
CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_name TEXT NOT NULL,
  destination TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  start_km INT NOT NULL,
  end_km INT,
  fuel_liters NUMERIC,
  fuel_cost NUMERIC,
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Driver reads own trips, gestor reads all"
  ON public.trips FOR SELECT
  USING (auth.uid() = driver_id OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Driver inserts own trips"
  ON public.trips FOR INSERT
  WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "Driver updates own trips, gestor updates all"
  ON public.trips FOR UPDATE
  USING (auth.uid() = driver_id OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Gestor deletes trips"
  ON public.trips FOR DELETE
  USING (public.has_role(auth.uid(), 'gestor'));

-- Maintenances
CREATE TABLE public.maintenances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  type public.maint_type NOT NULL,
  description TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  cost NUMERIC NOT NULL DEFAULT 0,
  odometer INT NOT NULL DEFAULT 0,
  status public.maint_status NOT NULL DEFAULT 'agendada',
  km_interval INT,
  months_interval INT,
  last_done_at TIMESTAMPTZ,
  last_done_km INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenances TO authenticated;
GRANT ALL ON public.maintenances TO service_role;
ALTER TABLE public.maintenances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read maintenances"
  ON public.maintenances FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "Gestor manages maintenances"
  ON public.maintenances FOR ALL
  USING (public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));

CREATE INDEX idx_trips_driver ON public.trips(driver_id);
CREATE INDEX idx_trips_vehicle ON public.trips(vehicle_id);
CREATE INDEX idx_maint_vehicle ON public.maintenances(vehicle_id);
