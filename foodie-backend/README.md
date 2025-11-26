# Foodie Backend API Server

Backend server for the Foodie app that handles AI calls and protects API keys.

## 🔒 Security

**This backend is REQUIRED for production** to protect your Gemini API key. Never expose AI API keys in frontend code!

## 🚀 Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file:

```env
# Google Gemini AI API Key (NEVER commit this!)
GEMINI_API_KEY=your_actual_gemini_api_key

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_role_key

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS Configuration (comma-separated)
ALLOWED_ORIGINS=http://localhost:5173,https://yourapp.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. Run Server

Development mode (auto-restart):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## 📡 API Endpoints

### Health Check
```
GET /health
```

Returns server status.

### AI: Filter Hotspots
```
POST /api/ai/filter-hotspots
Content-Type: application/json

{
  "mood": "adventurous",
  "cravings": "spicy food",
  "profile": {
    "name": "John",
    "age": 25,
    "location": "New York"
  },
  "hotspots": [
    {
      "name": "Chinatown",
      "tags": ["asian", "spicy", "diverse"]
    }
  ]
}
```

Returns filtered hotspots based on AI analysis.

### AI: Rank Restaurants
```
POST /api/ai/rank-restaurants
Content-Type: application/json

{
  "mood": "relaxed",
  "cravings": "italian",
  "profile": { ... },
  "restaurants": [
    {
      "name": "Luigi's",
      "cuisine": "Italian",
      "tags": ["pasta", "pizza"]
    }
  ]
}
```

Returns ranked restaurants with AI reasoning.

### Get Reviews
```
GET /api/reviews/:placeId
```

Returns all reviews for a restaurant.

### Add Review
```
POST /api/reviews
Content-Type: application/json

{
  "restaurant_place_id": "ChIJxyz",
  "restaurant_name": "Luigi's",
  "restaurant_address": "123 Main St",
  "user_id": "uuid",
  "user_name": "John",
  "rating": 5,
  "text": "Amazing food!"
}
```

Adds a new review.

## 🔐 Security Features

- **Helmet.js**: Security headers
- **CORS**: Whitelist allowed origins
- **Rate Limiting**: Prevent API abuse
- **Input Validation**: All inputs validated
- **Error Handling**: Safe error messages

## 📊 Rate Limits

- **Default**: 100 requests per 15 minutes
- Configurable via environment variables

## 🚀 Deployment

### Heroku

```bash
heroku create foodie-backend
heroku config:set GEMINI_API_KEY=your_key
heroku config:set NODE_ENV=production
git push heroku main
```

### Railway

```bash
railway init
railway add
railway up
```

### Vercel (Serverless)

Add `vercel.json`:

```json
{
  "version": 2,
  "builds": [{ "src": "server.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "/server.js" }]
}
```

Deploy:
```bash
vercel
```

## 🧪 Testing

```bash
# Test health endpoint
curl http://localhost:3001/health

# Test AI filtering
curl -X POST http://localhost:3001/api/ai/filter-hotspots \
  -H "Content-Type: application/json" \
  -d '{"mood":"happy","cravings":"pizza","profile":{...},"hotspots":[...]}'
```

## 📝 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | ✅ | Supabase service role key |
| `PORT` | ❌ | Server port (default: 3001) |
| `NODE_ENV` | ❌ | Environment (development/production) |
| `ALLOWED_ORIGINS` | ❌ | CORS whitelist (comma-separated) |
| `RATE_LIMIT_WINDOW_MS` | ❌ | Rate limit window (default: 15min) |
| `RATE_LIMIT_MAX_REQUESTS` | ❌ | Max requests per window (default: 100) |

## 🔧 Troubleshooting

### CORS Errors
Add your frontend URL to `ALLOWED_ORIGINS`:
```env
ALLOWED_ORIGINS=http://localhost:5173,https://yourapp.com
```

### Rate Limit Hit
Increase limits:
```env
RATE_LIMIT_MAX_REQUESTS=200
```

### AI Errors
Check your Gemini API key and quota.

## 📄 License

MIT
