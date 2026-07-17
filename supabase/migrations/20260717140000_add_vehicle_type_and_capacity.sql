CREATE TYPE public.vehicle_type AS ENUM ('caminhao', 'caminhao_munck', 'bongo', 'utilitario');

ALTER TABLE public.vehicles
  ADD COLUMN vehicle_type public.vehicle_type NOT NULL DEFAULT 'utilitario',
  ADD COLUMN max_load_kg INTEGER NOT NULL DEFAULT 0 CHECK (max_load_kg >= 0);

COMMENT ON COLUMN public.vehicles.vehicle_type IS 'Categoria operacional do veículo';
COMMENT ON COLUMN public.vehicles.max_load_kg IS 'Capacidade máxima de carga informada em quilogramas';
