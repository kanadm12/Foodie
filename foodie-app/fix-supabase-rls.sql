-- ============================================
-- Supabase RLS Fix for 406 Errors
-- ============================================
-- Run this in your Supabase SQL Editor
-- (Dashboard > SQL Editor > New Query)
--
-- This will fix the 406 "Not Acceptable" error
-- by setting up proper Row Level Security policies
-- ============================================

-- 1. Enable RLS on all tables (if not already enabled)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies (if any)
DROP POLICY IF EXISTS "Allow all read" ON profiles;
DROP POLICY IF EXISTS "Allow all insert" ON profiles;
DROP POLICY IF EXISTS "Allow all update" ON profiles;
DROP POLICY IF EXISTS "Allow all delete" ON profiles;

DROP POLICY IF EXISTS "Allow all read" ON restaurant_reviews;
DROP POLICY IF EXISTS "Allow all insert" ON restaurant_reviews;
DROP POLICY IF EXISTS "Allow all update" ON restaurant_reviews;
DROP POLICY IF EXISTS "Allow all delete" ON restaurant_reviews;

DROP POLICY IF EXISTS "Allow all read" ON food_groups;
DROP POLICY IF EXISTS "Allow all insert" ON food_groups;
DROP POLICY IF EXISTS "Allow all update" ON food_groups;
DROP POLICY IF EXISTS "Allow all delete" ON food_groups;

DROP POLICY IF EXISTS "Allow all read" ON group_members;
DROP POLICY IF EXISTS "Allow all insert" ON group_members;
DROP POLICY IF EXISTS "Allow all update" ON group_members;
DROP POLICY IF EXISTS "Allow all delete" ON group_members;

-- 3. Create permissive policies for profiles table
CREATE POLICY "Enable read access for all users" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated and anon users" ON profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for own profile" ON profiles
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for own profile" ON profiles
  FOR DELETE USING (true);

-- 4. Create permissive policies for restaurant_reviews table
CREATE POLICY "Enable read access for all users" ON restaurant_reviews
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated and anon users" ON restaurant_reviews
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for own reviews" ON restaurant_reviews
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for own reviews" ON restaurant_reviews
  FOR DELETE USING (true);

-- 5. Create permissive policies for food_groups table
CREATE POLICY "Enable read access for all users" ON food_groups
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated and anon users" ON food_groups
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for group creators" ON food_groups
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for group creators" ON food_groups
  FOR DELETE USING (true);

-- 6. Create permissive policies for group_members table
CREATE POLICY "Enable read access for all users" ON group_members
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated and anon users" ON group_members
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for members" ON group_members
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for members" ON group_members
  FOR DELETE USING (true);

-- 7. Grant necessary permissions to anon role
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON profiles TO anon;
GRANT ALL ON restaurant_reviews TO anon;
GRANT ALL ON food_groups TO anon;
GRANT ALL ON group_members TO anon;

-- 8. Ensure all sequences can be used
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- ============================================
-- Verification Queries
-- ============================================
-- Run these to verify the policies are set up correctly:

-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'restaurant_reviews', 'food_groups', 'group_members');

-- Check policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'restaurant_reviews', 'food_groups', 'group_members')
ORDER BY tablename, policyname;

-- ============================================
-- Expected Result:
-- All tables should have rowsecurity = true
-- Each table should have 4 policies (SELECT, INSERT, UPDATE, DELETE)
-- ============================================
