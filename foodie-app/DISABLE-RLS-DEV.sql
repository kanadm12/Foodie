-- ============================================
-- QUICK FIX: Disable RLS for Development
-- ============================================
-- Copy and paste this into Supabase SQL Editor:
-- https://supabase.com/dashboard/project/qmyqrwepajutlmxnlkae/sql/new
--
-- This will immediately fix the 406 error
-- ============================================

-- Disable RLS temporarily (for development only)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE food_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE group_members DISABLE ROW LEVEL SECURITY;

-- Verify (should show all as false)
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'restaurant_reviews', 'food_groups', 'group_members');

-- ============================================
-- After pasting, click "Run" button
-- Then refresh your app in the browser
-- ============================================
