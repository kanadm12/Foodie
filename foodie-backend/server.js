import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Too many requests, please try again later.',
});
app.use('/api/', limiter);

// Initialize AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Initialize Supabase (for direct database access if needed)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// AI: Filter Hotspots
app.post('/api/ai/filter-hotspots', async (req, res) => {
    try {
        const { mood, cravings, profile, hotspots } = req.body;
        
        // Validation
        if (!mood || !cravings || !profile || !hotspots) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        if (!Array.isArray(hotspots) || hotspots.length === 0) {
            return res.status(400).json({ error: 'Invalid hotspots data' });
        }
        
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
        
        const prompt = `You are a food recommendation AI. User mood: "${mood}". Cravings: "${cravings}". 
Profile: ${profile.name}, age ${profile.age}, location ${profile.location}.

Hotspots to filter:
${hotspots.map((h, i) => `${i + 1}. ${h.name} - ${h.tags.join(', ')}`).join('\n')}

Return a JSON array of hotspot indices (0-based) that match the user's mood and cravings. 
Include at least 5 results. Format: [0, 2, 4, ...]`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        
        // Extract JSON array from response
        const jsonMatch = text.match(/\[[\d,\s]+\]/);
        if (!jsonMatch) {
            throw new Error('Invalid AI response format');
        }
        
        const indices = JSON.parse(jsonMatch[0]);
        const filteredHotspots = indices
            .filter(i => i >= 0 && i < hotspots.length)
            .map(i => hotspots[i]);
        
        res.json({ hotspots: filteredHotspots });
    } catch (error) {
        console.error('AI filter error:', error);
        res.status(500).json({ 
            error: 'Failed to filter hotspots',
            fallback: true 
        });
    }
});

// AI: Rank Restaurants
app.post('/api/ai/rank-restaurants', async (req, res) => {
    try {
        const { mood, cravings, profile, restaurants } = req.body;
        
        // Validation
        if (!mood || !cravings || !profile || !restaurants) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        if (!Array.isArray(restaurants) || restaurants.length === 0) {
            return res.status(400).json({ error: 'Invalid restaurants data' });
        }
        
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
        
        const prompt = `You are a food recommendation AI. User mood: "${mood}". Cravings: "${cravings}".
Profile: ${profile.name}, age ${profile.age}, location ${profile.location}.

Restaurants to rank:
${restaurants.map((r, i) => `${i}. ${r.name} - ${r.cuisine} (${r.tags.join(', ')})`).join('\n')}

Provide a ranked JSON array with reasoning. Format:
[
  {
    "index": 0,
    "reasoning": "Perfect match because..."
  },
  ...
]

Order by best match first. Include all restaurants that serve the requested cuisine.`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        
        // Extract JSON array
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error('Invalid AI response format');
        }
        
        const rankings = JSON.parse(jsonMatch[0]);
        const rankedRestaurants = rankings
            .filter(r => r.index >= 0 && r.index < restaurants.length)
            .map(r => ({
                ...restaurants[r.index],
                aiReasoning: r.reasoning
            }));
        
        res.json({ restaurants: rankedRestaurants });
    } catch (error) {
        console.error('AI rank error:', error);
        res.status(500).json({ 
            error: 'Failed to rank restaurants',
            fallback: true 
        });
    }
});

// Reviews endpoints (proxy to Supabase with additional logic)
app.get('/api/reviews/:placeId', async (req, res) => {
    try {
        const { placeId } = req.params;
        const { data, error } = await supabase
            .from('restaurant_reviews')
            .select('*')
            .eq('restaurant_place_id', placeId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        res.json({ reviews: data });
    } catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

app.post('/api/reviews', async (req, res) => {
    try {
        const reviewData = req.body;
        
        // Validation
        if (!reviewData.restaurant_place_id || !reviewData.rating || !reviewData.text) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        if (reviewData.rating < 1 || reviewData.rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }
        
        if (reviewData.text.length < 10 || reviewData.text.length > 1000) {
            return res.status(400).json({ error: 'Review text must be 10-1000 characters' });
        }
        
        const { data, error } = await supabase
            .from('restaurant_reviews')
            .insert(reviewData)
            .select()
            .single();
        
        if (error) throw error;
        res.json({ review: data });
    } catch (error) {
        console.error('Add review error:', error);
        res.status(500).json({ error: 'Failed to add review' });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ 
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : error.message 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
    console.log(`✅ Foodie Backend running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
});
