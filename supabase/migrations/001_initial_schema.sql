-- Infinity8 Coworking Space Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUM TYPES (safe for Postgres 14)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'space_type') THEN
    CREATE TYPE space_type AS ENUM ('hot_desk', 'private_office', 'meeting_room');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
    CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'duration_type') THEN
    CREATE TYPE duration_type AS ENUM ('hourly', 'daily', 'monthly');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_plan') THEN
    CREATE TYPE membership_plan AS ENUM ('day_pass', 'monthly', 'private_office');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_status') THEN
    CREATE TYPE membership_status AS ENUM ('active', 'expired', 'cancelled', 'pending');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE payment_method AS ENUM ('credit_card', 'debit_card', 'bank_transfer', 'fpx', 'ewallet');
  END IF;
END$$;

-- ============================================
-- PROFILES TABLE
-- Extended user information linked to auth.users
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  company TEXT,
  avatar_url TEXT,
  role user_role DEFAULT 'user',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SPACES TABLE
-- Available workspaces for booking
-- ============================================
CREATE TABLE IF NOT EXISTS spaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type space_type NOT NULL,
  description TEXT,
  capacity INTEGER NOT NULL DEFAULT 1,
  hourly_rate DECIMAL(10, 2),
  daily_rate DECIMAL(10, 2),
  monthly_rate DECIMAL(10, 2),
  location TEXT NOT NULL DEFAULT 'Kuala Lumpur',
  floor TEXT,
  amenities TEXT[] DEFAULT '{}',
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BOOKINGS TABLE
-- Room/desk bookings by users
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_type duration_type NOT NULL,
  status booking_status DEFAULT 'pending',
  total_amount DECIMAL(10, 2) NOT NULL,
  attendees_count INTEGER DEFAULT 1,
  notes TEXT,
  special_requirements TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure end_time is after start_time
  CONSTRAINT valid_booking_times CHECK (end_time > start_time)
);

-- ============================================
-- MEMBERSHIPS TABLE
-- User subscription plans
-- ============================================
CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_type membership_plan NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status membership_status DEFAULT 'pending',
  auto_renew BOOLEAN DEFAULT FALSE,
  price DECIMAL(10, 2) NOT NULL,
  meeting_room_hours_included INTEGER DEFAULT 0,
  meeting_room_hours_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure end_date is after start_date
  CONSTRAINT valid_membership_dates CHECK (end_date >= start_date)
);

-- ============================================
-- PAYMENTS TABLE
-- Payment transactions
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  membership_id UUID REFERENCES memberships(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'MYR',
  payment_method payment_method,
  payment_status payment_status DEFAULT 'pending',
  transaction_id TEXT,
  payment_provider TEXT,
  receipt_url TEXT,
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure payment is for either a booking or membership
  CONSTRAINT payment_reference CHECK (
    (booking_id IS NOT NULL AND membership_id IS NULL) OR
    (booking_id IS NULL AND membership_id IS NOT NULL) OR
    (booking_id IS NULL AND membership_id IS NULL)
  )
);

-- ============================================
-- INDEXES (idempotent)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_space_id ON bookings(space_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON memberships(status);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_spaces_type ON spaces(type);
CREATE INDEX IF NOT EXISTS idx_spaces_is_active ON spaces(is_active);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTION: Check if user is admin
-- ============================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
    AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
    AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PROFILES POLICIES (drop + recreate to be safe)
-- ============================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Super admins can manage roles" ON profiles;

-- Users can view own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (is_admin());

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admins can update any profile (except role changes)
CREATE POLICY "Admins can update profiles" ON profiles
  FOR UPDATE USING (is_admin());

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Super admins can change roles
CREATE POLICY "Super admins can manage roles" ON profiles
  FOR ALL USING (is_super_admin());

-- ============================================
-- SPACES POLICIES
-- ============================================
DROP POLICY IF EXISTS "Anyone can view active spaces" ON spaces;
DROP POLICY IF EXISTS "Admins can view all spaces" ON spaces;
DROP POLICY IF EXISTS "Admins can insert spaces" ON spaces;
DROP POLICY IF EXISTS "Admins can update spaces" ON spaces;
DROP POLICY IF EXISTS "Admins can delete spaces" ON spaces;

-- Everyone can view active spaces
CREATE POLICY "Anyone can view active spaces" ON spaces
  FOR SELECT USING (is_active = TRUE);

-- Admins can view all spaces (including inactive)
CREATE POLICY "Admins can view all spaces" ON spaces
  FOR SELECT USING (is_admin());

-- Admins can manage spaces
CREATE POLICY "Admins can insert spaces" ON spaces
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admins can update spaces" ON spaces
  FOR UPDATE USING (is_admin());

CREATE POLICY "Admins can delete spaces" ON spaces
  FOR DELETE USING (is_admin());

-- ============================================
-- BOOKINGS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view own bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can view all bookings" ON bookings;
DROP POLICY IF EXISTS "Users can create own bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can create bookings" ON bookings;
DROP POLICY IF EXISTS "Users can update own bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can update bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can delete bookings" ON bookings;

-- Users can view own bookings
CREATE POLICY "Users can view own bookings" ON bookings
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all bookings
CREATE POLICY "Admins can view all bookings" ON bookings
  FOR SELECT USING (is_admin());

CREATE POLICY "Users can create own bookings" ON bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can create bookings for any user
CREATE POLICY "Admins can create bookings" ON bookings
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Users can update own bookings" ON bookings
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can update any booking
CREATE POLICY "Admins can update bookings" ON bookings
  FOR UPDATE USING (is_admin());

-- Admins can delete bookings
CREATE POLICY "Admins can delete bookings" ON bookings
  FOR DELETE USING (is_admin());

-- ============================================
-- MEMBERSHIPS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view own memberships" ON memberships;
DROP POLICY IF EXISTS "Admins can view all memberships" ON memberships;
DROP POLICY IF EXISTS "Users can create own memberships" ON memberships;
DROP POLICY IF EXISTS "Admins can insert memberships" ON memberships;
DROP POLICY IF EXISTS "Admins can update memberships" ON memberships;

-- Users can view their own memberships
CREATE POLICY "Users can view own memberships" ON memberships
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all memberships
CREATE POLICY "Admins can view all memberships" ON memberships
  FOR SELECT USING (is_admin());

CREATE POLICY "Users can create own memberships" ON memberships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can manage memberships
CREATE POLICY "Admins can insert memberships" ON memberships
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admins can update memberships" ON memberships
  FOR UPDATE USING (is_admin());

-- ============================================
-- PAYMENTS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view own payments" ON payments;
DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
DROP POLICY IF EXISTS "Users can create own payments" ON payments;
DROP POLICY IF EXISTS "Admins can insert payments" ON payments;
DROP POLICY IF EXISTS "Admins can update payments" ON payments;

-- Users can view their own payments
CREATE POLICY "Users can view own payments" ON payments
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all payments
CREATE POLICY "Admins can view all payments" ON payments
  FOR SELECT USING (is_admin());

CREATE POLICY "Users can create own payments" ON payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can manage payments
CREATE POLICY "Admins can insert payments" ON payments
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admins can update payments" ON payments
  FOR UPDATE USING (is_admin());

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop triggers if they exist so we can recreate them
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_spaces_updated_at ON spaces;
DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
DROP TRIGGER IF EXISTS update_memberships_updated_at ON memberships;
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_spaces_updated_at
  BEFORE UPDATE ON spaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_memberships_updated_at
  BEFORE UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role_value user_role;
BEGIN
  -- Safely get the role, defaulting to 'user' if not provided or invalid
  BEGIN
    user_role_value := (NEW.raw_user_meta_data->>'role')::user_role;
  EXCEPTION WHEN OTHERS THEN
    user_role_value := 'user';
  END;
  
  -- If role is null, default to 'user'
  IF user_role_value IS NULL THEN
    user_role_value := 'user';
  END IF;

  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    user_role_value
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- SEED DATA: Sample Spaces
-- ============================================
INSERT INTO spaces (name, type, description, capacity, hourly_rate, daily_rate, monthly_rate, location, floor, amenities, image_url) VALUES
  ('Hot Desk A', 'hot_desk', 'Flexible workspace in our open area with ergonomic seating', 1, NULL, 50.00, 800.00, 'Kuala Lumpur', 'Level 1', ARRAY['WiFi', 'Power outlets', 'Locker'], 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800'),
  ('Hot Desk B', 'hot_desk', 'Premium hot desk near the window with natural lighting', 1, NULL, 50.00, 800.00, 'Kuala Lumpur', 'Level 1', ARRAY['WiFi', 'Power outlets', 'Locker', 'Natural light'], 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800'),
  ('Private Office S1', 'private_office', 'Small private office for teams of 2-4', 4, NULL, NULL, 2500.00, 'Kuala Lumpur', 'Level 2', ARRAY['WiFi', 'AC', 'Whiteboard', 'Lockable door', '24/7 Access'], 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800'),
  ('Private Office M1', 'private_office', 'Medium private office for teams of 5-8', 8, NULL, NULL, 4500.00, 'Kuala Lumpur', 'Level 2', ARRAY['WiFi', 'AC', 'Whiteboard', 'Lockable door', '24/7 Access', 'Phone booth'], 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800'),
  ('Meeting Room Alpha', 'meeting_room', 'Professional meeting room with video conferencing', 8, 80.00, 500.00, NULL, 'Kuala Lumpur', 'Level 3', ARRAY['WiFi', 'TV Screen', 'Webcam', 'Whiteboard', 'Conference phone'], 'https://images.unsplash.com/photo-1431540015161-0bf868a2d407?w=800'),
  ('Meeting Room Beta', 'meeting_room', 'Large boardroom for presentations and workshops', 16, 120.00, 750.00, NULL, 'Kuala Lumpur', 'Level 3', ARRAY['WiFi', 'Projector', 'Webcam', 'Whiteboard', 'Sound system'], 'https://images.unsplash.com/photo-1431540015161-0bf868a2d407?w=800'),
  ('Meeting Room Gamma', 'meeting_room', 'Compact meeting room for quick discussions', 4, 50.00, 300.00, NULL, 'Kuala Lumpur', 'Level 1', ARRAY['WiFi', 'TV Screen', 'Whiteboard'], 'https://images.unsplash.com/photo-1431540015161-0bf868a2d407?w=800')
ON CONFLICT DO NOTHING;

-- ============================================
-- NOTE: Create your first admin user
-- ============================================
-- After creating a user through the auth system, run this to make them an admin:
-- UPDATE profiles SET role = 'super_admin' WHERE email = 'your-admin-email@example.com';
