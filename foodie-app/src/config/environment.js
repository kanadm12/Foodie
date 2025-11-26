/**
 * Environment configuration for production
 */

const isDevelopment = import.meta.env.MODE === 'development';
const isProduction = import.meta.env.MODE === 'production';

export const ENV = {
    isDevelopment,
    isProduction,
    
    // Supabase
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    
    // Google Maps (safe for client-side, restrict by domain in production)
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    
    // API (backend server for AI calls - NEVER expose AI keys to frontend)
    apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
    
    // Feature flags
    features: {
        analytics: isProduction,
        errorTracking: isProduction,
        devTools: isDevelopment,
    },
};

// Validate required environment variables
export const validateEnv = () => {
    const required = [
        'VITE_SUPABASE_URL',
        'VITE_SUPABASE_ANON_KEY',
        'VITE_GOOGLE_MAPS_API_KEY',
    ];
    
    const missing = required.filter(key => !import.meta.env[key]);
    
    if (missing.length > 0) {
        console.error('Missing required environment variables:', missing);
        return false;
    }
    
    return true;
};

export default ENV;
