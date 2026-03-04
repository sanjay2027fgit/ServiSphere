-- Supabase schema for ServiSphere core entities and roles

-- Enable UUIDs (if not already enabled in your project)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================
-- Users (all roles)
-- ============================

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  password text NOT NULL,
  role text NOT NULL CHECK (role IN ('user','worker','admin','special-admin')),
  name text,
  provider text DEFAULT 'local',
  created_at timestamptz DEFAULT now()
);

-- ============================
-- Bookings
-- ============================

CREATE TABLE IF NOT EXISTS public.bookings (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  otp text,
  user_lat double precision,
  user_lng double precision,
  worker_lat double precision,
  worker_lng double precision,
  created_at timestamptz DEFAULT now()
);

-- ============================
-- Payments
-- ============================

CREATE TABLE IF NOT EXISTS public.payments (
  id bigserial PRIMARY KEY,
  booking_id bigint NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('pending','paid_by_user','approved')) DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- ============================
-- Feedback
-- ============================

CREATE TABLE IF NOT EXISTS public.feedback (
  id bigserial PRIMARY KEY,
  booking_id bigint NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating int CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz DEFAULT now()
);

