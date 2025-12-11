-- Migration: Add Stripe customer ID to profiles and more spaces for PJ/JB
-- Run this in your Supabase SQL Editor

-- ============================================
-- ADD STRIPE CUSTOMER ID TO PROFILES
-- ============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON profiles(stripe_customer_id);

-- ============================================
-- ADD MORE SPACES FOR PJ AND JB LOCATIONS
-- ============================================

-- Petaling Jaya Spaces
INSERT INTO spaces (name, type, description, capacity, hourly_rate, daily_rate, monthly_rate, location, floor, amenities, image_url) VALUES
  ('Hot Desk PJ-1', 'hot_desk', 'Flexible workspace in our PJ location with garden view', 1, NULL, 50.00, 800.00, 'Petaling Jaya', 'Level 2', ARRAY['WiFi', 'Power outlets', 'Locker', 'Garden view'], 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800'),
  ('Hot Desk PJ-2', 'hot_desk', 'Quiet zone hot desk perfect for focused work', 1, NULL, 50.00, 800.00, 'Petaling Jaya', 'Level 2', ARRAY['WiFi', 'Power outlets', 'Locker', 'Quiet zone'], 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800'),
  ('Private Office PJ-S1', 'private_office', 'Small private office for startups in PJ', 4, NULL, NULL, 2200.00, 'Petaling Jaya', 'Level 3', ARRAY['WiFi', 'AC', 'Whiteboard', 'Lockable door', '24/7 Access'], 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800'),
  ('Meeting Room PJ-Alpha', 'meeting_room', 'Modern meeting room with video conferencing in PJ', 6, 70.00, 450.00, NULL, 'Petaling Jaya', 'Level 3', ARRAY['WiFi', 'TV Screen', 'Webcam', 'Whiteboard'], 'https://images.unsplash.com/photo-1431540015161-0bf868a2d407?w=800'),
  ('Meeting Room PJ-Beta', 'meeting_room', 'Large conference room for workshops in PJ', 12, 100.00, 650.00, NULL, 'Petaling Jaya', 'Level 3', ARRAY['WiFi', 'Projector', 'Webcam', 'Whiteboard', 'Sound system'], 'https://images.unsplash.com/photo-1431540015161-0bf868a2d407?w=800')
ON CONFLICT DO NOTHING;

-- Johor Bahru Spaces
INSERT INTO spaces (name, type, description, capacity, hourly_rate, daily_rate, monthly_rate, location, floor, amenities, image_url) VALUES
  ('Hot Desk JB-1', 'hot_desk', 'Affordable hot desk in our JB location', 1, NULL, 45.00, 700.00, 'Johor Bahru', 'Level 1', ARRAY['WiFi', 'Power outlets', 'Locker'], 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800'),
  ('Hot Desk JB-2', 'hot_desk', 'Window seat hot desk with city view', 1, NULL, 45.00, 700.00, 'Johor Bahru', 'Level 1', ARRAY['WiFi', 'Power outlets', 'Locker', 'City view'], 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800'),
  ('Private Office JB-S1', 'private_office', 'Compact private office for small teams in JB', 3, NULL, NULL, 1800.00, 'Johor Bahru', 'Level 2', ARRAY['WiFi', 'AC', 'Whiteboard', 'Lockable door'], 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800'),
  ('Private Office JB-M1', 'private_office', 'Medium private office for growing teams in JB', 6, NULL, NULL, 3500.00, 'Johor Bahru', 'Level 2', ARRAY['WiFi', 'AC', 'Whiteboard', 'Lockable door', '24/7 Access', 'Phone booth'], 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800'),
  ('Meeting Room JB-Alpha', 'meeting_room', 'Professional meeting room in JB', 8, 60.00, 400.00, NULL, 'Johor Bahru', 'Level 2', ARRAY['WiFi', 'TV Screen', 'Webcam', 'Whiteboard'], 'https://images.unsplash.com/photo-1431540015161-0bf868a2d407?w=800'),
  ('Meeting Room JB-Gamma', 'meeting_room', 'Small huddle room for quick discussions in JB', 4, 40.00, 250.00, NULL, 'Johor Bahru', 'Level 1', ARRAY['WiFi', 'TV Screen', 'Whiteboard'], 'https://images.unsplash.com/photo-1431540015161-0bf868a2d407?w=800')
ON CONFLICT DO NOTHING;

-- ============================================
-- UPDATE RLS POLICY FOR stripe_customer_id
-- ============================================
-- Users can only see their own stripe_customer_id (already covered by existing policies)

-- ============================================
-- SUMMARY
-- ============================================
-- After running this migration, you should have:
-- 1. stripe_customer_id column in profiles table
-- 2. 7 spaces in Kuala Lumpur (from initial migration)
-- 3. 5 spaces in Petaling Jaya (new)
-- 4. 6 spaces in Johor Bahru (new)
-- Total: 18 spaces across 3 locations
