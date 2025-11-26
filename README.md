# 🍕 Foodie - AI-Powered Restaurant Discovery App

[![React](https://img.shields.io/badge/React-19.0-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-7.2-646CFF.svg)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Foodie** is a production-ready web application that uses AI to help you discover restaurants based on your mood and cravings. Built with React, powered by Google Gemini AI, and featuring real-time data from Google Places API.

![Foodie App Screenshot](https://via.placeholder.com/800x400/1a1a2e/ffffff?text=Foodie+App+Screenshot)

## ✨ Features

- 🤖 **AI-Powered Search** - "Find My Vibe" understands your mood and cravings
- 🗺️ **Interactive Maps** - Real-time restaurant locations with route directions
- 📍 **Location-Based** - Automatically finds restaurants near you
- ⭐ **Reviews System** - Read and write restaurant reviews
- 👥 **Social Groups** - Create and join foodie groups with friends
- 🔒 **Secure Backend** - API keys protected, rate limiting enabled
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile
- 🌙 **Dark Mode** - Beautiful dark theme optimized for food browsing

## 🚀 Live Demo

Visit: [Your deployed URL here]

## 📸 Screenshots

<details>
<summary>Click to expand screenshots</summary>

### Home Screen
![Home](https://via.placeholder.com/600x300/1a1a2e/ffffff?text=Home+Screen)

### AI Search
![Search](https://via.placeholder.com/600x300/1a1a2e/ffffff?text=AI+Search)

### Restaurant Details
![Details](https://via.placeholder.com/600x300/1a1a2e/ffffff?text=Restaurant+Details)

</details>

## 🛠️ Tech Stack

### Frontend
- **React 19** - Modern UI library with hooks
- **Vite 7.2** - Lightning-fast build tool
- **Tailwind CSS 3.4** - Utility-first styling
- **Lucide React** - Beautiful icons
- **Google Maps API** - Interactive maps and geocoding

### Backend
- **Node.js + Express** - RESTful API server
- **Google Gemini AI** - AI-powered recommendations
- **Supabase** - PostgreSQL database + authentication
- **Helmet.js** - Security headers
- **Express Rate Limit** - API protection

## 📋 Prerequisites

- Node.js 18+ and npm
- Google Maps API key
- Google Gemini API key
- Supabase account

## 🔧 Installation

### 1. Clone the repository

```bash
git clone https://github.com/kanadm12/Foodie.git
cd Foodie
```

### 2. Setup Frontend

```bash
cd foodie-app
npm install

# Create .env.local file
cp .env.example .env.local

# Edit .env.local and add your API keys:
# VITE_SUPABASE_URL=your_supabase_url
# VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
# VITE_GOOGLE_MAPS_API_KEY=your_google_maps_key
# VITE_API_URL=http://localhost:3001/api
```

### 3. Setup Backend

```bash
cd ../foodie-backend
npm install

# Create .env file
cp .env.example .env

# Edit .env and add:
# GEMINI_API_KEY=your_gemini_api_key
# SUPABASE_URL=your_supabase_url
# SUPABASE_SERVICE_KEY=your_service_key
# PORT=3001
```

### 4. Setup Database

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project
3. Run the SQL from `foodie-app/DISABLE-RLS-DEV.sql` for development
4. Or use `foodie-app/fix-supabase-rls.sql` for production with proper RLS policies

### 5. Enable Google APIs

Go to [Google Cloud Console](https://console.cloud.google.com/):
- Enable **Places API**
- Enable **Geocoding API**
- Enable **Maps JavaScript API**
- Create/restrict your API key

## 🚀 Running the App

### Development Mode

**Terminal 1 - Frontend:**
```bash
cd foodie-app
npm run dev
# Runs on http://localhost:5173
```

**Terminal 2 - Backend:**
```bash
cd foodie-backend
npm start
# Runs on http://localhost:3001
```

### Production Build

```bash
cd foodie-app
npm run build
npm run preview
```

## 📁 Project Structure

```
Foodie/
├── foodie-app/                 # Frontend React application
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── config/            # Environment configuration
│   │   ├── services/          # API service layer
│   │   ├── utils/             # Validation & helpers
│   │   ├── App.jsx            # Main application component
│   │   └── main.jsx           # React entry point
│   ├── public/                # Static assets
│   ├── .env.example           # Environment template
│   ├── PRODUCTION.md          # Production deployment checklist
│   └── QUICKSTART.md          # Quick start guide
│
├── foodie-backend/            # Backend API server
│   ├── server.js              # Express server with AI endpoints
│   ├── package.json
│   └── .env.example
│
└── README.md                  # This file
```

## 🔑 Environment Variables

### Frontend (.env.local)

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_GOOGLE_MAPS_API_KEY=your_maps_key
VITE_API_URL=http://localhost:3001/api
```

### Backend (.env)

```env
GEMINI_API_KEY=your_gemini_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173,https://yourapp.com
```

## 🎯 Key Features Explained

### AI-Powered Search ("Find My Vibe")
Enter your mood and cravings (e.g., "happy pizza" or "adventurous spicy food"), and the AI ranks restaurants that match your preferences.

### Smart Fallback System
If AI services are unavailable, the app uses intelligent local scoring algorithms to still provide relevant suggestions.

### Real-Time Data Integration
- Google Places API fetches real restaurants near your location
- Geocoding converts any address to coordinates
- Directions API shows routes from your location to restaurants

### Security Features
- API keys protected in backend
- Rate limiting (100 requests per 15 minutes)
- Input validation and sanitization
- CORS whitelist
- Security headers via Helmet.js

## 📖 API Documentation

### Backend Endpoints

#### Health Check
```
GET /health
Response: { status: "ok", timestamp: "..." }
```

#### Filter Hotspots
```
POST /api/ai/filter-hotspots
Body: { mood, cravings, profile, hotspots }
Response: { hotspots: [...] }
```

#### Rank Restaurants
```
POST /api/ai/rank-restaurants
Body: { mood, cravings, profile, restaurants }
Response: { restaurants: [...] }
```

See `foodie-backend/README.md` for full API documentation.

## 🚢 Deployment

### Frontend (Vercel/Netlify)

```bash
cd foodie-app
npm run build
vercel --prod
```

### Backend (Railway/Heroku)

```bash
cd foodie-backend
railway up
# or
git push heroku main
```

See `PRODUCTION.md` for complete deployment checklist.

## 🔒 Security Considerations

### Development
- ⚠️ RLS disabled for easy testing
- ⚠️ Permissive CORS settings
- ⚠️ Mock data fallbacks

### Production Checklist
- ✅ Enable Supabase RLS policies
- ✅ Restrict Google Maps API by domain
- ✅ Update CORS whitelist
- ✅ Enable error tracking (Sentry)
- ✅ Set up monitoring
- ✅ Use HTTPS only
- ✅ Environment variables on hosting platform

## 🐛 Troubleshooting

### "406 Not Acceptable" Error
- Run the SQL in `DISABLE-RLS-DEV.sql` to disable RLS
- Or set up proper RLS policies with `fix-supabase-rls.sql`

### "Places API REQUEST_DENIED"
- Enable Places API in Google Cloud Console
- Check API key restrictions
- Verify billing is enabled (free tier available)

### Backend Connection Failed
- Ensure backend is running on port 3001
- Check `VITE_API_URL` in frontend `.env.local`
- Verify CORS settings allow your frontend origin

### AI Returns Empty Results
- Check Gemini API key is valid
- Verify backend `.env` has correct key
- Check API quota limits

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Google Gemini AI](https://ai.google.dev/) for AI capabilities
- [Supabase](https://supabase.com/) for database and auth
- [Google Maps Platform](https://developers.google.com/maps) for mapping
- [Lucide Icons](https://lucide.dev/) for beautiful icons
- [Tailwind CSS](https://tailwindcss.com/) for styling

## 📧 Contact

**Project Link**: [https://github.com/kanadm12/Foodie](https://github.com/kanadm12/Foodie)

**Issues**: [https://github.com/kanadm12/Foodie/issues](https://github.com/kanadm12/Foodie/issues)

---

⭐ If you found this project helpful, please give it a star!

Made with ❤️ and 🍕
