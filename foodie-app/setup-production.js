#!/usr/bin/env node

/**
 * Production Setup Script for Foodie App
 * Run with: node setup-production.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

console.log(`
╔══════════════════════════════════════════════════════════╗
║  🍕 Foodie App - Production Setup                       ║
║                                                          ║
║  This script will help you set up the app for          ║
║  production deployment.                                 ║
╚══════════════════════════════════════════════════════════╝
`);

async function main() {
    console.log('\n📋 Step 1: Environment Variables\n');
    
    const supabaseUrl = await question('Supabase URL: ');
    const supabaseAnonKey = await question('Supabase Anon Key: ');
    const supabaseServiceKey = await question('Supabase Service Role Key: ');
    const googleMapsKey = await question('Google Maps API Key: ');
    const geminiKey = await question('Google Gemini API Key: ');
    
    console.log('\n📝 Creating environment files...\n');
    
    // Frontend .env.local
    const frontendEnv = `# Supabase Configuration
VITE_SUPABASE_URL=${supabaseUrl}
VITE_SUPABASE_ANON_KEY=${supabaseAnonKey}

# Google Maps API Key (restrict by domain!)
VITE_GOOGLE_MAPS_API_KEY=${googleMapsKey}

# Backend API URL
VITE_API_URL=http://localhost:3001/api

# Environment
VITE_ENV=production
`;
    
    fs.writeFileSync(path.join(__dirname, '.env.local'), frontendEnv);
    console.log('✅ Created frontend .env.local');
    
    // Backend .env
    const backendEnv = `# Google Gemini AI API Key (NEVER expose to frontend!)
GEMINI_API_KEY=${geminiKey}

# Supabase Configuration
SUPABASE_URL=${supabaseUrl}
SUPABASE_SERVICE_KEY=${supabaseServiceKey}

# Server Configuration
PORT=3001
NODE_ENV=production

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:5173,https://yourapp.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
`;
    
    const backendPath = path.join(__dirname, '..', 'foodie-backend');
    if (fs.existsSync(backendPath)) {
        fs.writeFileSync(path.join(backendPath, '.env'), backendEnv);
        console.log('✅ Created backend .env');
    } else {
        console.log('⚠️  Backend folder not found. Please create it manually.');
    }
    
    console.log('\n🔒 Step 2: Security Checklist\n');
    console.log('□ Restrict Google Maps API key by HTTP referrer');
    console.log('□ Enable Supabase Row Level Security (RLS)');
    console.log('□ Set up CORS whitelist for production domain');
    console.log('□ Configure rate limiting');
    console.log('□ Set up SSL/HTTPS');
    console.log('□ Enable error tracking (Sentry)');
    
    console.log('\n🚀 Step 3: Deployment\n');
    console.log('Frontend (Vercel/Netlify):');
    console.log('  npm run build');
    console.log('  vercel deploy --prod');
    
    console.log('\nBackend (Railway/Heroku):');
    console.log('  cd ../foodie-backend');
    console.log('  npm install');
    console.log('  railway up');
    
    console.log('\n✅ Setup complete! Review PRODUCTION.md for full checklist.\n');
    
    rl.close();
}

main().catch(console.error);
