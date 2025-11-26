/**
 * Supabase Connection Diagnostic
 * Run with: node check-supabase.js
 * 
 * Note: Set these environment variables before running:
 *   $env:VITE_SUPABASE_URL="your_url"
 *   $env:VITE_SUPABASE_ANON_KEY="your_key"
 *   node check-supabase.js
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    console.log('\nRequired variables:');
    console.log('  VITE_SUPABASE_URL');
    console.log('  VITE_SUPABASE_ANON_KEY');
    process.exit(1);
}

console.log('🔍 Testing Supabase Connection...\n');
console.log(`URL: ${supabaseUrl}`);
console.log(`Key: ${supabaseKey.substring(0, 20)}...\n`);

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true
    },
    global: {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    }
});

async function testConnection() {
    try {
        // Test 1: Sign in anonymously
        console.log('1️⃣ Testing anonymous sign-in...');
        const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
        
        if (authError) {
            console.error('   ❌ Auth error:', authError.message);
            return;
        }
        console.log(`   ✅ Signed in as: ${authData.user.id}`);
        
        // Test 2: Check profiles table access
        console.log('\n2️⃣ Testing profiles table access...');
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .limit(1);
        
        if (profileError) {
            console.error('   ❌ Profile query error:', profileError);
            console.log('\n   Possible causes:');
            console.log('   • Table "profiles" does not exist');
            console.log('   • Row Level Security (RLS) is blocking access');
            console.log('   • API key does not have permissions');
            
            // Check if it's a 406 error
            if (profileError.code === '406' || profileError.message.includes('406')) {
                console.log('\n   ⚠️  406 Error detected!');
                console.log('   This usually means:');
                console.log('   1. Missing Accept header (fixed in code)');
                console.log('   2. RLS policy blocking anonymous users');
                console.log('\n   Fix: Run this SQL in Supabase:');
                console.log('   ```sql');
                console.log('   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;');
                console.log('   CREATE POLICY "Allow anonymous read" ON profiles FOR SELECT USING (true);');
                console.log('   CREATE POLICY "Allow anonymous insert" ON profiles FOR INSERT WITH CHECK (true);');
                console.log('   CREATE POLICY "Allow anonymous update" ON profiles FOR UPDATE USING (true);');
                console.log('   ```');
            }
            return;
        }
        
        console.log('   ✅ Profiles table accessible');
        console.log(`   Found ${profiles?.length || 0} profiles`);
        
        // Test 3: Try to insert a test profile
        console.log('\n3️⃣ Testing profile insert...');
        const testProfile = {
            id: authData.user.id,
            name: 'Test User',
            age: 25,
            location: 'Test City'
        };
        
        const { error: insertError } = await supabase
            .from('profiles')
            .upsert(testProfile);
        
        if (insertError) {
            console.error('   ❌ Insert error:', insertError.message);
            return;
        }
        
        console.log('   ✅ Profile insert successful');
        
        // Test 4: Query the inserted profile
        console.log('\n4️⃣ Testing profile query...');
        const { data: queryData, error: queryError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .single();
        
        if (queryError) {
            console.error('   ❌ Query error:', queryError.message);
            return;
        }
        
        console.log('   ✅ Profile query successful');
        console.log('   Data:', queryData);
        
        console.log('\n✅ All tests passed! Supabase is working correctly.');
        
    } catch (error) {
        console.error('\n❌ Unexpected error:', error.message);
    }
}

testConnection();
