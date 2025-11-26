import React, { useState, useEffect, createContext, useContext, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
    MapPin, 
    Sparkles, 
    Users, 
    X, 
    Loader2, 
    Star, 
    BookOpen, 
    Map as MapIcon, 
    AlertTriangle, 
    Flame, 
    FilterX 
} from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import { validateSearchInput, sanitizeInput, validateName, validateAge, validateLocation, validateReviewText } from './utils/validation';
import ENV, { validateEnv } from './config/environment';

// Global reference for drawing routes (set by MapContainer, used by RestaurantList)
let globalDrawRoute = null;
const setGlobalDrawRoute = (fn) => { globalDrawRoute = fn; };
const getGlobalDrawRoute = () => globalDrawRoute;

// --- 1. YOUR PROVIDED APP CONFIGURATION ---
const appConfig = {
    // 1. Supabase Project URL
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL, 
    // 2. Supabase Anon Key (This is safe to expose)
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    // 3. Google Maps API Key
    //    SECURITY: Move to backend for production!
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    // 4. Gemini API Key
    //    SECURITY: MUST be on a backend for production!
    geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY 
};
// ----------------------------------------

// --- 2. Create Supabase Client (Singleton - prevent multiple instances) ---
let supabaseInstance = null;

// Only create once at module load time with proper options
if (!supabaseInstance && appConfig.supabaseUrl && appConfig.supabaseAnonKey) {
    supabaseInstance = createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        },
        db: {
            schema: 'public'
        },
        global: {
            headers: {
                'apikey': appConfig.supabaseAnonKey,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        }
    });
}

const supabase = supabaseInstance || createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    },
    db: {
        schema: 'public'
    },
    global: {
        headers: {
            'apikey': appConfig.supabaseAnonKey,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    }
});

// --- 3. React Context for Auth & Supabase ---
const SupabaseContext = createContext(null);

// Custom hook to use the context
const useSupabase = () => {
    const context = useContext(SupabaseContext);
    if (!context) {
        throw new Error("useSupabase must be used within a SupabaseProvider");
    }
    return context;
};

// Provider component
const SupabaseProvider = ({ children }) => {
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        
        // Try Supabase with aggressive timeout
        const initAuth = async () => {
            try {
                // Very short timeout - 2 seconds max
                const { data: { session } } = await Promise.race([
                    supabase.auth.getSession(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000))
                ]);
                
                if (session) {
                    setSession(session);
                    const userProfile = await getUserProfile(session.user.id);
                    setProfile(userProfile);
                } else {
                    // Try anonymous login
                    const { data } = await Promise.race([
                        supabase.auth.signInAnonymously(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000))
                    ]);
                    if (data?.session) {
                        setSession(data.session);
                    }
                }
            } catch (err) {
                console.warn("Supabase unavailable, using offline mode:", err.message);
                // Load profile from localStorage as fallback
                const savedProfile = localStorage.getItem('foodie_profile');
                if (savedProfile) {
                    setProfile(JSON.parse(savedProfile));
                }
            } finally {
                setLoading(false);
            }
        };

        initAuth();

        // Listen for auth changes (non-blocking)
        try {
            const { data: { subscription } } = supabase.auth.onAuthStateChange(
                async (_event, session) => {
                    setSession(session);
                }
            );
            return () => subscription.unsubscribe();
        } catch (err) {
            // Supabase not available
            return () => {};
        }
    }, []);

    const getUserProfile = async (userId) => {
        if (!userId) return null;
        try {
            const { data, error } = await Promise.race([
                supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', userId)
                    .single(),
                new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000))
            ]);
            
            if (error) {
                // If profile doesn't exist (404), return null instead of throwing
                if (error.code === 'PGRST116') {
                    console.log("Profile not found, will create on save");
                    return null;
                }
                // Check for 406 errors (RLS policy issue)
                if (error.code === '406' || error.message.includes('406')) {
                    console.error("⚠️ 406 Error: Supabase RLS is blocking access!");
                    console.error("Fix: Run 'DISABLE-RLS-DEV.sql' in Supabase SQL Editor");
                    console.error("SQL: ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;");
                    return null;
                }
                console.error("Profile fetch error:", error);
                return null;
            }
            
            return data;
        } catch (error) {
            if (error.message === "timeout") {
                console.warn("⚠️ Profile fetch timed out - likely RLS blocking access");
                console.warn("Fix: Disable RLS in Supabase (see DISABLE-RLS-DEV.sql)");
            } else {
                console.warn("Could not fetch profile:", error.message);
            }
            return null;
        }
    };

    const value = {
        supabase,
        session,
        profile,
        loadingProfile: loading,
        refreshProfile: async () => {
            if (session) {
                const userProfile = await getUserProfile(session.user.id);
                setProfile(userProfile);
            }
        },
        signOut: async () => {
            try {
                localStorage.removeItem('foodie_profile');
                setProfile(null);
                setSession(null);
                await supabase.auth.signOut();
            } catch (error) {
                console.error("Sign out error:", error);
            }
        }
    };

    return <SupabaseContext.Provider value={value}>{children}</SupabaseContext.Provider>;
};

// --- 4. Main App Component ---
export default function App() {
    // Validate environment on startup
    useEffect(() => {
        if (!validateEnv()) {
            console.error('Missing required environment variables. Check your .env.local file.');
        }
    }, []);

    return (
        <ErrorBoundary>
            <SupabaseProvider>
                <StyleInjector />
                <FoodieApp />
                <GlobalLoading />
                <GlobalMessage />
            </SupabaseProvider>
        </ErrorBoundary>
    );
}

// This component holds the main app logic
function FoodieApp() {
    const { profile, loadingProfile, signOut } = useSupabase();
    const [currentPage, setCurrentPage] = useState('loading');
    const [selectedRestaurant, setSelectedRestaurant] = useState(null);
    const [selectedGroup, setSelectedGroup] = useState(null);

    // Main state for map data
    const [allHotspots, setAllHotspots] = useState([]);
    const [allRestaurants, setAllRestaurants] = useState([]);
    
    // State for filtered/ranked data
    const [filteredHotspots, setFilteredHotspots] = useState([]);
    const [rankedRestaurants, setRankedRestaurants] = useState([]);
    const [aiReasoningMap, setAiReasoningMap] = useState({});

    const [isFiltered, setIsFiltered] = useState(false);

    // Cache for mock data
    const dataCache = useRef({ hotspots: null, restaurants: null });

    // AI search cache
    const aiSearchCache = useMemo(() => new Map(), []);

    // Load initial map data (hotspots & restaurants)
    useEffect(() => {
        if (!profile) return; // Wait for profile to load

        const loadInitialData = async () => {
            setLoading("Loading real-time restaurants near you...");
            try {
                // Wait a bit for Google Maps to initialize
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                let hotspots = dataCache.current.hotspots;
                let restaurants = dataCache.current.restaurants;

                if (!hotspots) {
                    console.log("Fetching real hotspots for:", profile.location);
                    hotspots = await getRealHotspotData(profile.location);
                    dataCache.current.hotspots = hotspots;
                    console.log(`Found ${hotspots.length} hotspots`);
                }
                if (!restaurants) {
                    console.log("Fetching real restaurants for:", profile.location);
                    restaurants = await getRealRestaurantData(profile.location);
                    dataCache.current.restaurants = restaurants;
                    console.log(`Found ${restaurants.length} restaurants`);
                }
                
                setAllHotspots(hotspots);
                setAllRestaurants(restaurants);
                
                // Initially, the filtered list is the full list
                setFilteredHotspots(hotspots);
                setRankedRestaurants(restaurants);
                setAiReasoningMap({});
                setIsFiltered(false);

            } catch (error) {
                console.error("Error loading initial data:", error);
                showMessage("Could not load map data.", "error");
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, [profile]); // Re-load if profile (and location) changes

    // Page routing logic
    useEffect(() => {
        if (loadingProfile) {
            setCurrentPage('loading');
        } else if (!profile || !profile.name) {
            setCurrentPage('userInfo');
        } else {
            setCurrentPage('main');
        }
    }, [profile, loadingProfile]);

    const handleRestaurantSelect = (restaurant) => {
        setSelectedRestaurant(restaurant);
        setCurrentPage('restaurantDetail');
    };

    const handleCloseDetails = () => {
        setSelectedRestaurant(null);
        setCurrentPage('main');
    };
    
    const handleShowGroups = () => {
        setCurrentPage('groups');
    };
    
    const handleCloseGroups = () => {
        setCurrentPage('main');
    };

    const handleClearFilter = () => {
        setFilteredHotspots(allHotspots);
        setRankedRestaurants(allRestaurants);
        setAiReasoningMap({});
        setIsFiltered(false);
    };

    return (
        <div className="relative min-h-screen h-screen flex flex-col">
            {currentPage === 'loading' && (
                <div className="flex items-center justify-center h-full bg-gray-900">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="animate-spin h-12 w-12 text-indigo-500" />
                        <p className="text-gray-400">Loading your foodie profile...</p>
                    </div>
                </div>
            )} 
            {currentPage === 'userInfo' && <UserInfoModal />}
            {currentPage === 'main' && (
                <MainApp
                    hotspots={filteredHotspots}
                    restaurants={rankedRestaurants}
                    aiReasoningMap={aiReasoningMap}
                    allHotspots={allHotspots}
                    allRestaurants={allRestaurants}
                    setFilteredHotspots={setFilteredHotspots}
                    setRankedRestaurants={setRankedRestaurants}
                    setAiReasoningMap={setAiReasoningMap}
                    aiSearchCache={aiSearchCache}
                    isFiltered={isFiltered}
                    setIsFiltered={setIsFiltered}
                    onRestaurantSelect={handleRestaurantSelect}
                    onShowGroups={handleShowGroups}
                    onClearFilter={handleClearFilter}
                    onSignOut={signOut}
                />
            )}
            {currentPage === 'restaurantDetail' && (
                <RestaurantDetailModal
                    restaurant={selectedRestaurant}
                    onClose={handleCloseDetails}
                />
            )}
            {currentPage === 'groups' && <GroupsModal onClose={handleCloseGroups} />}
        </div>
    );
}

// --- 5. Page/Modal Components ---

function UserInfoModal() {
    const { supabase, session, refreshProfile } = useSupabase();
    const [name, setName] = useState('');
    const [age, setAge] = useState('');
    const [location, setLocation] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name || !age || !location) return;
        
        setLoading("Saving profile...");
        try {
            const profileData = {
                id: session?.user?.id || 'offline-user',
                name,
                age: parseInt(age, 10),
                location
            };
            
            // Try to save to Supabase with timeout
            if (session) {
                try {
                    const { error } = await Promise.race([
                        supabase
                            .from('profiles')
                            .upsert(profileData, { 
                                onConflict: 'id',
                                ignoreDuplicates: false 
                            }),
                        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000))
                    ]);
                    
                    if (error) {
                        console.warn("Supabase save error:", error);
                        localStorage.setItem('foodie_profile', JSON.stringify(profileData));
                    }
                } catch (err) {
                    console.warn("Supabase save failed, using localStorage:", err.message);
                    localStorage.setItem('foodie_profile', JSON.stringify(profileData));
                }
            } else {
                // Offline mode - save to localStorage
                localStorage.setItem('foodie_profile', JSON.stringify(profileData));
            }
            
            // Proceed to main app
            await refreshProfile();
        } catch (error) {
            console.error("Error saving profile:", error);
            showMessage("There was an issue, but proceeding anyway...", "warning");
            await refreshProfile();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop">
            <div className="bg-gray-800 w-full max-w-md p-8 rounded-2xl shadow-2xl border border-gray-700">
                <h2 className="text-3xl font-bold text-white text-center mb-2">Welcome to <span className="gradient-text">Foodie</span></h2>
                <p className="text-gray-400 text-center mb-6">Let's get to know you so we can find your vibe.</p>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Your Name</label>
                        <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} required
                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            placeholder="e.g., Alex Johnson" />
                    </div>
                    <div>
                        <label htmlFor="age" className="block text-sm font-medium text-gray-300 mb-1">Your Age</label>
                        <input type="number" id="age" value={age} onChange={(e) => setAge(e.target.value)} required min="13"
                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            placeholder="e.g., 25" />
                    </div>
                    <div>
                        <label htmlFor="location" className="block text-sm font-medium text-gray-300 mb-1">Your Location (City or Zip)</label>
                        <input type="text" id="location" value={location} onChange={(e) => setLocation(e.target.value)} required
                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            placeholder="e.g., Brooklyn, NY or 11201" />
                    </div>
                    <button type="submit"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200 text-lg shadow-lg">
                        Find My Food
                    </button>
                </form>
            </div>
        </div>
    );
}

function MainApp({ 
    hotspots, restaurants, aiReasoningMap, onRestaurantSelect, onShowGroups, 
    allHotspots, allRestaurants, setFilteredHotspots, setRankedRestaurants, 
    setAiReasoningMap, aiSearchCache, isFiltered, setIsFiltered, onClearFilter, onSignOut
}) {
    const { profile } = useSupabase();
    const [currentTab, setCurrentTab] = useState('hotspots'); // 'hotspots' or 'restaurants'

    return (
        <div className="flex flex-col h-screen overflow-hidden">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-gray-900/80 backdrop-blur-md border-b border-gray-700 flex-shrink-0">
                <div className="container mx-auto max-w-full px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <h1 className="text-3xl font-bold gradient-text">Foodie</h1>
                        <div className="flex items-center space-x-4">
                            <span className="text-xs text-gray-500 hidden sm:block">
                                ID: {profile?.id.substring(0, 8)}...
                            </span>
                            <button onClick={onShowGroups} className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200">
                                <Users size={16} />
                                <span>Groups</span>
                            </button>
                            <button onClick={onSignOut} className="flex items-center space-x-2 bg-red-700 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition duration-200">
                                <X size={16} />
                                <span>Sign Out</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* AI Search Bar */}
            <AiSearchBar 
                profile={profile}
                allHotspots={allHotspots}
                allRestaurants={allRestaurants}
                setFilteredHotspots={setFilteredHotspots}
                setRankedRestaurants={setRankedRestaurants}
                setAiReasoningMap={setAiReasoningMap}
                aiSearchCache={aiSearchCache}
                setIsFiltered={setIsFiltered}
                onClearFilter={onClearFilter}
                isFiltered={isFiltered}
            />

            {/* Content Area (Map + List) - Scrollable with larger sizes */}
            <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto overflow-x-hidden">
                {/* Map Column - 50% width, increased height */}
                <div className="lg:col-span-1 min-h-96 lg:h-[calc(100vh-280px)] rounded-2xl shadow-2xl overflow-hidden bg-gray-800 border border-gray-700 sticky top-0">
                    <MapContainer 
                        hotspots={hotspots} 
                        restaurants={restaurants} 
                        profile={profile}
                        onRestaurantSelect={onRestaurantSelect}
                    />
                </div>

                {/* List Column - 50% width, increased height */}
                <div className="lg:col-span-1 min-h-96 lg:h-[calc(100vh-280px)] flex flex-col bg-gray-800/50 rounded-2xl border border-gray-700 overflow-hidden">
                    {/* Tab Headers */}
                    <div className="flex border-b border-gray-700 flex-shrink-0">
                        <TabButton
                            id="hotspots"
                            title="Hotspots"
                            icon={Flame}
                            activeTab={currentTab}
                            onClick={setCurrentTab}
                        />
                        <TabButton
                            id="restaurants"
                            title="Restaurants"
                            icon={MapPin}
                            activeTab={currentTab}
                            onClick={setCurrentTab}
                        />
                    </div>
                    
                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {currentTab === 'hotspots' && (
                            <HotspotList hotspots={hotspots} />
                        )}
                        {currentTab === 'restaurants' && (
                            <RestaurantList 
                                restaurants={restaurants} 
                                aiReasoningMap={aiReasoningMap} 
                                onRestaurantSelect={onRestaurantSelect} 
                            />
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

function RestaurantDetailModal({ restaurant, onClose }) {
    const { supabase, session, profile } = useSupabase();
    const [reviews, setReviews] = useState([]);
    const [loadingReviews, setLoadingReviews] = useState(true);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewText, setReviewText] = useState('');
    const mapRef = useRef(null); // Ref to hold the map instance
    const directionsRendererRef = useRef(null);
    const userLocationMarkerRef = useRef(null);

    // Fetch reviews
    const fetchReviews = async () => {
        setLoadingReviews(true);
        try {
            const { data, error } = await supabase
                .from('restaurant_reviews')
                .select()
                .eq('restaurant_place_id', restaurant.placeId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setReviews(data || []);
        } catch (error) {
            console.error("Error fetching reviews:", error);
            showMessage("Could not load reviews.", "error");
        } finally {
            setLoadingReviews(false);
        }
    };

    // Fetch and subscribe to reviews
    useEffect(() => {
        if (!restaurant) return;
        
        fetchReviews();

        const channel = supabase
            .channel(`public:restaurant_reviews:place_id=${restaurant.placeId}`)
            .on('postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'restaurant_reviews', filter: `restaurant_place_id=eq.${restaurant.placeId}` },
                (payload) => {
                    setReviews(currentReviews => [payload.new, ...currentReviews]);
                }
            ).subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [restaurant, supabase]);

    // Handle review submission
    const handleReviewSubmit = async (e) => {
        e.preventDefault();
        if (!reviewText || !session) {
            showMessage("Please write a review.", "warn");
            return;
        }
        
        setLoading("Submitting review...");
        try {
            const reviewData = {
                restaurant_place_id: restaurant.placeId,
                restaurant_name: restaurant.name,
                restaurant_address: restaurant.address,
                user_id: session.user.id,
                user_name: profile.name,
                rating: parseInt(reviewRating, 10),
                text: reviewText
            };
            const { error } = await supabase.from('restaurant_reviews').insert(reviewData);
            if (error) throw error;
            
            showMessage("Review added successfully!", "success");
            setReviewText('');
            setReviewRating(5);
            // We don't need to manually add the review, the subscription will catch it
        } catch (error) {
            console.error("Error adding review:", error);
            showMessage("Failed to add review.", "error");
        } finally {
            setLoading(false);
        }
    };

    // Init mini-map for directions
    const initMiniMap = (mapElement) => {
        if (!mapElement || !window.google || !profile || !restaurant) return;

        const geocoder = new google.maps.Geocoder();
        
        const map = new google.maps.Map(mapElement, {
            center: { lat: 40.692, lng: -73.987 },
            zoom: 13,
            mapId: "DETAIL_MAP_ID",
            disableDefaultUI: true,
            zoomControl: true,
            styles: [ // Dark mode map style
                { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
                { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
                { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
                { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
                { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
                { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
                { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
                { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
                { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
                { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
                { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
                { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
                { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
                { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
                { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
                { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
            ]
        });
        mapRef.current = map;
        directionsRendererRef.current = new google.maps.DirectionsRenderer({ map, suppressMarkers: true });

        // Geocode user location and restaurant location
        let userLatLng, restaurantLatLng;

        geocoder.geocode({ address: profile.location }, (results, status) => {
            if (status === 'OK' && results[0]) {
                userLatLng = results[0].geometry.location;
                userLocationMarkerRef.current = new google.maps.Marker({
                    position: userLatLng, map, title: "Your Location",
                    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#4285F4", fillOpacity: 1, strokeColor: "white", strokeWeight: 2 },
                });
                
                if (restaurantLatLng) calculateAndDisplayRoute(userLatLng, restaurantLatLng);
            }
        });
        
        geocoder.geocode({ address: restaurant.address }, (results, status) => {
            if (status === 'OK' && results[0]) {
                restaurantLatLng = results[0].geometry.location;
                new google.maps.Marker({
                    position: restaurantLatLng, map, title: restaurant.name
                });

                if (userLatLng) calculateAndDisplayRoute(userLatLng, restaurantLatLng);
            }
        });
    };

    const calculateAndDisplayRoute = (origin, destination) => {
        const directionsService = new google.maps.DirectionsService();
        directionsService.route({
            origin,
            destination,
            travelMode: google.maps.TravelMode.DRIVING
        }, (result, status) => {
            if (status === 'OK' && directionsRendererRef.current) {
                directionsRendererRef.current.setDirections(result);
            } else {
                console.error(`Directions request failed due to ${status}`);
            }
        });
    };

    return (
        <div className="fixed inset-0 z-50 p-4 pt-12 modal-backdrop overflow-y-auto">
            <div className="relative bg-gray-800 w-full max-w-4xl mx-auto p-6 sm:p-8 rounded-2xl shadow-2xl border border-gray-700">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition">
                    <X size={32} />
                </button>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left: Details & Map */}
                    <div className="space-y-6">
                        <h2 className="text-3xl font-bold text-white mb-2">{restaurant.name}</h2>
                        <p className="text-lg text-gray-400 mb-4">{restaurant.address}</p>
                        <p className="text-gray-300 mb-6">
                            <Sparkles className="w-5 h-5 inline-block text-indigo-400 -mt-1" />
                            <span className="font-semibold text-indigo-300"> AI Vibe: </span>
                            <span>{restaurant.aiReasoning || "A great local spot."}</span>
                        </p>
                        
                        <a href={restaurant.url || '#'} target="_blank" rel="noopener noreferrer"
                            className={`flex-1 flex items-center justify-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition duration-200 ${!restaurant.url ? 'hidden' : ''}`}>
                            <BookOpen size={20} />
                            <span>Visit Website</span>
                        </a>

                        {/* Mini-map for directions */}
                        <div ref={initMiniMap} className="h-64 w-full rounded-lg bg-gray-700 border border-gray-600"></div>
                    </div>

                    {/* Right: Reviews */}
                    <div className="flex flex-col space-y-6">
                        {/* Add Review */}
                        <div>
                            <h3 className="text-xl font-semibold text-white mb-4">Add Your Review</h3>
                            <form onSubmit={handleReviewSubmit} className="space-y-4">
                                <div>
                                    <label htmlFor="review-rating" className="block text-sm font-medium text-gray-300 mb-1">Rating</label>
                                    <select 
                                        id="review-rating" 
                                        value={reviewRating} 
                                        onChange={(e) => setReviewRating(e.target.value)}
                                        className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    >
                                        <option value="5">5 Stars</option>
                                        <option value="4">4 Stars</option>
                                        <option value="3">3 Stars</option>
                                        <option value="2">2 Stars</option>
                                        <option value="1">1 Star</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="review-text" className="block text-sm font-medium text-gray-300 mb-1">Review</label>
                                    <textarea 
                                        id="review-text" 
                                        rows="3" 
                                        required
                                        value={reviewText}
                                        onChange={(e) => setReviewText(e.target.value)}
                                        className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                        placeholder="What did you think?"
                                    />
                                </div>
                                <button type="submit"
                                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200">
                                    Submit Review
                                </button>
                            </form>
                        </div>

                        {/* See Reviews */}
                        <div>
                            <h3 className="text-xl font-semibold text-white mb-4">Community Reviews</h3>
                            <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
                                {loadingReviews ? (
                                    <p className="text-gray-400">Loading reviews...</p>
                                ) : reviews.length === 0 ? (
                                    <p className="text-gray-400">Be the first to leave a review!</p>
                                ) : (
                                    reviews.map(review => <ReviewCard key={review.id} review={review} />)
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function GroupsModal({ onClose }) {
    const { supabase, session, profile } = useSupabase();
    const [groups, setGroups] = useState([]);
    const [loadingGroups, setLoadingGroups] = useState(true);
    const [groupName, setGroupName] = useState('');
    const [groupDesc, setGroupDesc] = useState('');

    const isAnonymous = session?.user?.is_anonymous;

    // Fetch groups
    const fetchGroups = async () => {
        setLoadingGroups(true);
        try {
            const { data, error } = await supabase
                .from('food_groups')
                .select(`*, creator_name, group_members ( user_id, user_name )`)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setGroups(data || []);
        } catch (error) {
            console.error("Error fetching groups:", error);
            showMessage("Could not load groups.", "error");
        } finally {
            setLoadingGroups(false);
        }
    };

    // Fetch and subscribe to groups
    useEffect(() => {
        fetchGroups();

        const channel = supabase
            .channel('public:food_groups')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'food_groups' }, fetchGroups)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, fetchGroups)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase]);

    // Handle group creation
    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (!groupName || !groupDesc || !session) {
            showMessage("Please fill in all fields.", "warn");
            return;
        }

        setLoading("Creating group...");
        try {
            const { error } = await supabase.rpc('create_group_and_add_member', {
                _name: groupName,
                _description: groupDesc,
                _user_name: profile.name
            });
            if (error) throw error;

            showMessage("Group created!", "success");
            setGroupName('');
            setGroupDesc('');
            // Subscription will handle refetch
        } catch (error) {
            console.error("Error creating group:", error);
            showMessage("Failed to create group.", "error");
        } finally {
            setLoading(false);
        }
    };

    // Handle joining a group
    const handleJoinGroup = async (groupId) => {
        if (!session) return;
        
        setLoading("Joining group...");
        try {
            const { error } = await supabase.from('group_members').insert({
                group_id: groupId,
                user_id: session.user.id,
                user_name: profile.name
            });
            if (error) {
                if (error.code === '23505') showMessage("You are already in this group.", "warn");
                else throw error;
            } else {
                showMessage("Joined group!", "success");
                // Subscription will handle refetch
            }
        } catch (error) {
            console.error("Error joining group:", error);
            showMessage("Failed to join group.", "error");
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="fixed inset-0 z-50 p-4 pt-12 modal-backdrop overflow-y-auto">
            <div className="relative bg-gray-800 w-full max-w-4xl mx-auto p-6 sm:p-8 rounded-2xl shadow-2xl border border-gray-700">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition">
                    <X size={32} />
                </button>
                
                <h2 className="text-3xl font-bold text-white mb-6">Foodie Groups</h2>

                {isAnonymous && (
                    <div className="p-4 bg-yellow-900/50 border border-yellow-700 text-yellow-300 rounded-lg mb-6 flex space-x-3">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-1" />
                        <div>
                            <h4 className="font-bold">You are signed in as a guest.</h4>
                            <p className="text-sm">Your profile and group memberships are temporary and will be lost if you clear your browser data.</p>
                        </div>
                    </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left: Create Group */}
                    <div>
                        <h3 className="text-xl font-semibold text-white mb-4">Create a New Group</h3>
                        <form onSubmit={handleCreateGroup} className="space-y-4">
                            <div>
                                <label htmlFor="new-group-name" className="block text-sm font-medium text-gray-300 mb-1">Group Name</label>
                                <input type="text" id="new-group-name" value={groupName} onChange={(e) => setGroupName(e.target.value)} required
                                    className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    placeholder="e.g., Spicy Food Lovers" />
                            </div>
                            <div>
                                <label htmlFor="new-group-desc" className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                                <textarea id="new-group-desc" rows="3" value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} required
                                    className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    placeholder="What's this group about?" />
                            </div>
                            <button type="submit"
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200">
                                Create Group
                            </button>
                        </form>
                    </div>

                    {/* Right: Join Groups */}
                    <div>
                        <h3 className="text-xl font-semibold text-white mb-4">Join Existing Groups</h3>
                        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                            {loadingGroups ? (
                                <p className="text-gray-400">Loading groups...</p>
                            ) : groups.length === 0 ? (
                                <p className="text-gray-400">No groups found. Why not create one?</p>
                            ) : (
                                groups.map(group => (
                                    <GroupCard 
                                        key={group.id} 
                                        group={group} 
                                        currentUserId={session?.user.id}
                                        onJoin={handleJoinGroup}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- 6. Child Components ---

function AiSearchBar({ 
    profile, allHotspots, allRestaurants, setFilteredHotspots, 
    setRankedRestaurants, setAiReasoningMap, aiSearchCache, 
    setIsFiltered, onClearFilter, isFiltered
}) {
    const [mood, setMood] = useState('');
    const [cravings, setCravings] = useState('');

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!mood || !cravings) {
            showMessage("Please describe your mood and craving!", "warn");
            return;
        }

        setLoading("AI is filtering hotspots & restaurants...");
        try {
            // Run both AI jobs in parallel
            const [filteredHotspots, rankedRestaurantSuggestions] = await Promise.all([
                getAiFilteredHotspots(mood, cravings, profile, allHotspots, aiSearchCache),
                getAiRankedRestaurants(mood, cravings, profile, allRestaurants, aiSearchCache)
            ]);

            console.log("Search results:", { 
                hotspots: filteredHotspots?.length, 
                restaurants: rankedRestaurantSuggestions?.length,
                mood,
                cravings
            });

            // --- Process Restaurant Results ---
            const aiReasoningMap = Object.fromEntries(rankedRestaurantSuggestions.map(r => [r.placeId, r.reasoning]));
            const restaurantMap = new Map(allRestaurants.map(r => [r.placeId, r]));
            const filteredRestaurants = rankedRestaurantSuggestions.map(r => restaurantMap.get(r.placeId)).filter(Boolean); // Filter out any nulls
            
            // --- Update UI ---
            setFilteredHotspots(filteredHotspots || []);
            setRankedRestaurants(filteredRestaurants || []);
            setAiReasoningMap(aiReasoningMap);
            setIsFiltered(true);

            if (filteredHotspots.length === 0 && filteredRestaurants.length === 0) {
                showMessage("No matches found. Try different mood/craving!", "warn");
            }

        } catch (error) {
            console.error("Error during AI search:", error);
            showMessage(error.message || "Search failed", "error");
        } finally {
            setLoading(false);
        }
    };
    
    const handleClear = () => {
        setMood('');
        setCravings('');
        onClearFilter();
    };

    return (
        <div className="sticky top-20 z-20 bg-gray-900 pt-6 pb-8 shadow-lg flex-shrink-0">
            <div className="container mx-auto max-w-4xl px-4">
                <h2 className="text-3xl font-bold text-white text-center mb-6">
                    What's the vibe, {profile?.name.split(' ')[0]}?
                </h2>
                <form onSubmit={handleSearch} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="text" value={mood} onChange={(e) => setMood(e.target.value)} required
                            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-5 py-4 text-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            placeholder="How are you feeling?" />
                        <input type="text" value={cravings} onChange={(e) => setCravings(e.target.value)} required
                            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-5 py-4 text-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            placeholder="What are you craving?" />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <button type="submit"
                            className="flex-1 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-8 rounded-lg transition duration-200 text-xl shadow-lg flex items-center justify-center space-x-2">
                            <Sparkles size={24} />
                            <span>Find My Vibe</span>
                        </button>
                        {isFiltered && (
                            <button type="button" onClick={handleClear}
                                className="w-full sm:w-auto bg-gray-600 hover:bg-gray-700 text-white font-bold py-4 px-6 rounded-lg transition duration-200 text-xl shadow-lg flex items-center justify-center space-x-2">
                                <FilterX size={24} />
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}

function MapContainer({ hotspots, restaurants, profile, onRestaurantSelect }) {
    const mapRef = useRef(null); // Ref to hold the map HTML element
    const mapInstance = useRef(null); // Ref to hold the Google Map instance
    const heatmap = useRef(null);
    const markers = useRef([]);
    const userMarker = useRef(null);
    const routePolyline = useRef(null); // Ref for route polyline
    const directionService = useRef(null); // Direction service
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [userLocation, setUserLocation] = useState(null);

    // 1. Load Google Maps Script
    useEffect(() => {
        if (window.google && window.google.maps) {
            setIsMapLoaded(true);
            return;
        }

        // Check if script is already being loaded
        const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
        if (existingScript) {
            // Wait for Google Maps to be available
            const checkInterval = setInterval(() => {
                if (window.google && window.google.maps) {
                    clearInterval(checkInterval);
                    setIsMapLoaded(true);
                }
            }, 100);
            return () => clearInterval(checkInterval);
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${appConfig.googleMapsApiKey}&libraries=visualization,places,geocoding,routes&loading=async&v=weekly`;
        script.async = true;
        script.defer = true;
        
        // Handle script load
        script.onload = () => {
            setIsMapLoaded(true);
        };
        
        script.onerror = () => {
            showMessage("Could not load Google Maps.", "error");
        };
        
        document.head.appendChild(script);
        
        return () => {
            // Clean up if needed
        };
    }, []);

    // 2. Initialize Map
    useEffect(() => {
        if (!isMapLoaded || !mapRef.current || !profile) return; // Wait for API, ref, and profile
        if (mapInstance.current) return; // Map already initialized

        // Ensure Google Maps API is fully loaded
        if (!window.google || !window.google.maps || !window.google.maps.Geocoder) {
            return; // Exit and retry on next render
        }

        try {
            const geocoder = new google.maps.Geocoder();
        
            mapInstance.current = new google.maps.Map(mapRef.current, {
                center: { lat: 40.692, lng: -73.987 },
                zoom: 12,
                disableDefaultUI: true,
                zoomControl: true,
                streetViewControl: false,
                styles: [ // Dark mode map style
                    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
                    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
                    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
                    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
                    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
                    { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
                    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
                    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
                    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
                    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
                    { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
                    { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
                    { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
                    { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
                    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
                    { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
                ]
            });

            // Heatmap is deprecated in Google Maps API and causes errors
            // Disabling for now - markers are sufficient for visualization
            // heatmap.current = new google.maps.visualization.HeatmapLayer({ 
            //     data: [], 
            //     map: mapInstance.current,
            //     radius: 30,
            //     opacity: 0.8,
            //     gradient: [
            //         "rgba(0, 255, 255, 0)", "rgba(0, 255, 255, 1)", "rgba(0, 191, 255, 1)",
            //         "rgba(0, 127, 255, 1)", "rgba(0, 63, 255, 1)", "rgba(0, 0, 255, 1)",
            //         "rgba(0, 0, 223, 1)", "rgba(0, 0, 191, 1)", "rgba(0, 0, 159, 1)",
            //         "rgba(0, 0, 127, 1)", "rgba(63, 0, 91, 1)", "rgba(127, 0, 63, 1)",
            //         "rgba(191, 0, 31, 1)", "rgba(255, 0, 0, 1)",
            //     ]
            // });

            // Center map on user location
            geocoder.geocode({ address: profile.location }, (results, status) => {
                if (status === "OK" && results[0] && mapInstance.current) {
                    const userLatLng = results[0].geometry.location;
                    setUserLocation(userLatLng); // Save user location for routing
                    mapInstance.current.setCenter(userLatLng);
                    mapInstance.current.setZoom(13);
                    
                    if (userMarker.current) userMarker.current.setMap(null);
                    userMarker.current = new google.maps.Marker({
                        position: userLatLng, map: mapInstance.current, title: "Your Location (approx.)",
                        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#4285F4", fillOpacity: 1, strokeColor: "white", strokeWeight: 2 },
                    });
            
                    // Initialize directions service
                    directionService.current = new google.maps.DirectionsService();
                }
            });
        } catch (error) {
            console.error("Error initializing Google Maps:", error);
            showMessage("Could not initialize map. Please refresh the page.", "error");
        }

    }, [isMapLoaded, profile]);

    // 3. Update Heatmap when hotspots change
    // Heatmap is disabled due to API deprecation
    // useEffect(() => {
    //     if (!heatmap.current) return;
    //     
    //     const heatmapData = hotspots.map(spot => ({
    //         location: new google.maps.LatLng(spot.lat, spot.lng),
    //         weight: spot.review_count || 0
    //     }));
    //     heatmap.current.setData(heatmapData);
    // }, [hotspots]);

    // Function to draw route from user location to destination
    const drawRoute = (destination) => {
        if (!userLocation || !mapInstance.current || !directionService.current) {
            console.warn("Route prerequisites not ready:", { hasUserLocation: !!userLocation, hasMap: !!mapInstance.current, hasService: !!directionService.current });
            showMessage("Could not calculate route - location not available", "warning");
            return;
        }

        try {
            directionService.current.route({
                origin: userLocation,
                destination: destination,
                travelMode: google.maps.TravelMode.DRIVING
            }, (result, status) => {
                if (status === google.maps.DirectionsStatus.OK) {
                    // Clear previous route
                    if (routePolyline.current) routePolyline.current.setMap(null);

                    // Draw new route as polyline
                    routePolyline.current = new google.maps.Polyline({
                        path: result.routes[0].overview_path,
                        geodesic: true,
                        strokeColor: '#4285F4',
                        strokeOpacity: 0.8,
                        strokeWeight: 3,
                        map: mapInstance.current
                    });

                    // Fit bounds to show entire route
                    const bounds = new google.maps.LatLngBounds();
                    result.routes[0].overview_path.forEach(point => bounds.extend(point));
                    mapInstance.current.fitBounds(bounds, { padding: 100 });

                    // Show route info
                    const distance = result.routes[0].legs[0].distance.text;
                    const duration = result.routes[0].legs[0].duration.text;
                    showMessage(`Route: ${distance} • ${duration}`, "success");
                } else if (status === google.maps.DirectionsStatus.ZERO_RESULTS) {
                    showMessage("Route not available for this destination", "warning");
                } else {
                    console.error("Directions error:", status);
                    showMessage("Could not calculate route", "warning");
                }
            });
        } catch (error) {
            console.error("Error drawing route:", error);
            showMessage("Error calculating route", "error");
        }
    };

    // Register drawRoute globally so it can be called from RestaurantList
    useEffect(() => {
        setGlobalDrawRoute(drawRoute);
    }, [drawRoute]);

    // 4. Update Restaurant Markers when restaurants change
    useEffect(() => {
        if (!mapInstance.current || !window.google) return;
        
        // Clear old markers
        markers.current.forEach(marker => marker.setMap(null));
        markers.current = [];

        const geocoder = new google.maps.Geocoder();
        
        restaurants.forEach(restaurant => {
            geocoder.geocode({ address: restaurant.address }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    const location = results[0].geometry.location;
                    const marker = new google.maps.Marker({
                        position: location,
                        map: mapInstance.current,
                        title: restaurant.name,
                    });
                    marker.addListener("click", () => {
                        onRestaurantSelect(restaurant);
                        drawRoute(location); // Draw route to restaurant
                    });
                    markers.current.push(marker);
                }
            });
        });

    }, [restaurants, onRestaurantSelect]);

    return (
        <div id="map-container" ref={mapRef} className="h-full w-full">
            {!isMapLoaded && (
                <div className="flex items-center justify-center h-full text-gray-500">
                    <Loader2 className="animate-spin h-8 w-8 mr-2" />
                    Loading Map...
                </div>
            )}
        </div>
    );
}

function TabButton({ id, title, icon: Icon, activeTab, onClick }) {
    const isActive = activeTab === id;
    return (
        <button
            onClick={() => onClick(id)}
            className={`tab-btn ${isActive ? 'active' : ''}`}
        >
            <Icon size={16} className="inline-block -mt-1 mr-1" /> {title}
        </button>
    );
}

function HotspotList({ hotspots }) {
    // Map instance context would go here in a more complex app
    
    const handleHotspotClick = (spot) => {
        // In a more complex app, we'd use context to get the map instance
        console.log("Would pan to hotspot:", spot.name);
        showMessage(`Panning to ${spot.name} (simulation)`, "success");
    };

    if (hotspots.length === 0) {
        return <p className="text-gray-400 text-center">No hotspots match your search. Try something else!</p>;
    }
    
    return (
        <div className="space-y-4">
            {hotspots.map(spot => (
                <div 
                    key={spot.id} 
                    onClick={() => handleHotspotClick(spot)}
                    className="bg-gray-800 rounded-lg shadow-xl overflow-hidden cursor-pointer transform hover:scale-105 transition-transform duration-300"
                >
                    <div className="p-5">
                        <h3 className="text-lg font-bold text-white mb-2">{spot.name}</h3>
                        <div className="flex items-center text-sm text-yellow-400 mb-3">
                            <Flame className="w-4 h-4 mr-1" />
                            {(spot.review_count || 0).toLocaleString()} Reviews
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {(spot.tags || []).map(tag => (
                                <span key={tag} className="inline-block bg-gray-700 text-indigo-300 text-xs font-medium px-2 py-1 rounded-full">{tag}</span>
                            ))}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function RestaurantList({ restaurants, aiReasoningMap, onRestaurantSelect }) {
    if (restaurants.length === 0) {
        return <p className="text-gray-400 text-center">No restaurants match your search. Try something else!</p>;
    }
    
    return (
        <div className="space-y-4">
            {restaurants.map(restaurant => {
                const reasoning = aiReasoningMap[restaurant.placeId];
                // Attach reasoning for the detail modal
                const restaurantWithReasoning = { ...restaurant, aiReasoning: reasoning };
                
                return (
                    <div 
                        key={restaurant.placeId} 
                        onClick={() => {
                            onRestaurantSelect(restaurantWithReasoning);
                            // Draw route to this restaurant
                            const drawRoute = getGlobalDrawRoute();
                            if (drawRoute && restaurant.address) {
                                drawRoute(restaurant.address);
                            }
                        }}
                        className="bg-gray-800 rounded-lg shadow-xl overflow-hidden cursor-pointer transform hover:scale-105 transition-transform duration-300"
                    >
                        <div className="p-5">
                            <h3 className="text-lg font-bold text-white">{restaurant.name}</h3>
                            <p className="text-sm text-gray-400 mb-3">{restaurant.address}</p>
                            {reasoning ? (
                                <p className="text-gray-300">
                                    <Sparkles className="w-4 h-4 inline-block text-indigo-400 -mt-1" />
                                    <span className="font-semibold text-indigo-300"> AI Vibe: </span> {reasoning}
                                </p>
                            ) : (
                                <p className="text-sm text-gray-500">A great local spot.</p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function ReviewCard({ review }) {
    return (
        <div className="bg-gray-700 p-4 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-white">{review.user_name}</span>
                <div className="flex">
                    {[...Array(5)].map((_, i) => (
                        <Star key={i} size={16} className={i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-600'} />
                    ))}
                </div>
            </div>
            <p className="text-gray-300">{review.text}</p>
            <p className="text-xs text-gray-500 mt-2">{new Date(review.created_at).toLocaleString()}</p>
        </div>
    );
}

function GroupCard({ group, currentUserId, onJoin }) {
    const isMember = group.group_members.some(m => m.user_id === currentUserId);
    const memberCount = group.group_members.length;
    
    return (
        <div className="bg-gray-700 p-4 rounded-lg shadow-md flex justify-between items-center">
            <div>
                <h4 className="font-bold text-lg text-white">{group.name}</h4>
                <p className="text-gray-400 text-sm">{group.description}</p>
                <p className="text-xs text-gray-500 mt-1">
                    Created by {group.creator_name} | {memberCount} member(s)
                </p>
            </div>
            <button 
                onClick={() => !isMember && onJoin(group.id)}
                disabled={isMember}
                className={`text-white font-bold py-2 px-4 rounded-lg transition duration-200 ${
                    isMember 
                        ? 'bg-green-600 cursor-not-allowed' 
                        : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
            >
                {isMember ? 'Joined' : 'Join'}
            </button>
        </div>
    );
}

// --- 7. Global State & Helper Components ---

// Store state globally for simple access
const globalState = {
    loadingText: '',
    message: { text: '', type: 'success' },
    listeners: new Set(),
};

const notify = () => globalState.listeners.forEach(listener => listener());

const useGlobalState = () => {
    const [state, setState] = useState(globalState);
    
    useEffect(() => {
        const listener = () => setState({ ...globalState });
        globalState.listeners.add(listener);
        return () => globalState.listeners.delete(listener);
    }, []);
    
    return state;
};

// Global Loading Overlay
function GlobalLoading() {
    const { loadingText } = useGlobalState();
    const show = !!loadingText;

    return (
        <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gray-900/80 backdrop-blur-sm transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <Loader2 className="animate-spin h-12 w-12 text-indigo-500" />
            <p className="text-white text-xl font-semibold mt-4">{loadingText}</p>
        </div>
    );
}

// Global Message Box
function GlobalMessage() {
    const { message } = useGlobalState();
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (message.text) {
            setShow(true);
            const timer = setTimeout(() => setShow(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [message]);
    
    const colorClasses = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        warn: 'bg-yellow-500',
    };

    return (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[101] text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-500 ${colorClasses[message.type]} ${show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'}`}>
            <p>{message.text}</p>
        </div>
    );
}

// Global state mutator functions (to be called from anywhere)
const setLoading = (text) => {
    globalState.loadingText = text;
    notify();
};

const showMessage = (text, type = "success") => {
    globalState.message = { text, type };
    notify();
};

// --- 8. Mock Data & AI Functions ---

// (These are unchanged from the HTML version)

/**
 * Helper: Wait for Google Maps API to be ready
 */
function waitForGoogleMaps(timeout = 5000) {
    return new Promise((resolve, reject) => {
        if (typeof google !== 'undefined' && google.maps) {
            resolve(true);
            return;
        }
        
        const startTime = Date.now();
        const checkInterval = setInterval(() => {
            if (typeof google !== 'undefined' && google.maps) {
                clearInterval(checkInterval);
                resolve(true);
            } else if (Date.now() - startTime > timeout) {
                clearInterval(checkInterval);
                reject(new Error('Google Maps API not loaded'));
            }
        }, 100);
    });
}

/**
 * Get real hotspot data using Google Places Nearby Search
 * Fetches popular areas/neighborhoods with high restaurant density
 */
async function getRealHotspotData(location) {
    try {
        // Wait for Google Maps API to be ready
        await waitForGoogleMaps();
        
        // First, geocode the location to get coordinates
        const geocoder = new google.maps.Geocoder();
        const geocodeResult = await geocoder.geocode({ address: location });
        
        if (!geocodeResult.results || geocodeResult.results.length === 0) {
            console.warn("Geocoding failed, using mock data");
            return getMockHotspotData();
        }
        
        const { lat, lng } = geocodeResult.results[0].geometry.location;
        const center = { lat: lat(), lng: lng() };
        
        // Use Places Service to find popular areas (we'll search for "restaurants" and cluster them)
        const service = new google.maps.places.PlacesService(document.createElement('div'));
        
        const request = {
            location: center,
            radius: 5000, // 5km radius
            type: 'restaurant',
            rankBy: google.maps.places.RankBy.PROMINENCE
        };
        
        const results = await new Promise((resolve, reject) => {
            service.nearbySearch(request, (results, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK) {
                    resolve(results);
                } else {
                    reject(new Error(`Places API error: ${status}`));
                }
            });
        });
        
        // Group restaurants by neighborhood and create hotspots
        const neighborhoods = new Map();
        
        results.slice(0, 40).forEach(place => {
            // Extract neighborhood from address
            const neighborhood = place.vicinity?.split(',')[0] || place.name;
            
            if (!neighborhoods.has(neighborhood)) {
                neighborhoods.set(neighborhood, {
                    places: [],
                    totalRating: 0,
                    totalReviews: 0,
                    types: new Set(),
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng()
                });
            }
            
            const data = neighborhoods.get(neighborhood);
            data.places.push(place);
            data.totalRating += place.rating || 0;
            data.totalReviews += place.user_ratings_total || 0;
            place.types?.forEach(t => data.types.add(t));
        });
        
        // Convert to hotspot format
        const hotspots = Array.from(neighborhoods.entries())
            .map(([name, data], idx) => ({
                id: idx + 1,
                name: name,
                address: data.places[0]?.vicinity || location,
                lat: data.lat,
                lng: data.lng,
                review_count: data.totalReviews,
                tags: Array.from(data.types)
                    .filter(t => t !== 'point_of_interest' && t !== 'establishment')
                    .map(t => t.replace(/_/g, ' '))
                    .slice(0, 5)
            }))
            .sort((a, b) => b.review_count - a.review_count)
            .slice(0, 15);
        
        return hotspots.length > 0 ? hotspots : getMockHotspotData();
        
    } catch (error) {
        console.warn("Google Places API not available, using mock data");
        console.warn("To enable: Go to Google Cloud Console → APIs & Services → Enable 'Places API'");
        console.warn("Error:", error.message);
        return getMockHotspotData();
    }
}

/**
 * Get real restaurant data using Google Places Nearby Search
 */
async function getRealRestaurantData(location) {
    try {
        // Wait for Google Maps API to be ready
        await waitForGoogleMaps();
        
        // Geocode the location
        const geocoder = new google.maps.Geocoder();
        const geocodeResult = await geocoder.geocode({ address: location });
        
        if (!geocodeResult.results || geocodeResult.results.length === 0) {
            console.warn("Geocoding failed, using mock data");
            return getMockGooglePlacesData(location);
        }
        
        const { lat, lng } = geocodeResult.results[0].geometry.location;
        const center = { lat: lat(), lng: lng() };
        
        // Search for restaurants
        const service = new google.maps.places.PlacesService(document.createElement('div'));
        
        const request = {
            location: center,
            radius: 3000, // 3km radius
            type: 'restaurant',
            rankBy: google.maps.places.RankBy.PROMINENCE
        };
        
        const results = await new Promise((resolve, reject) => {
            service.nearbySearch(request, (results, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK) {
                    resolve(results);
                } else {
                    reject(new Error(`Places API error: ${status}`));
                }
            });
        });
        
        // Convert to our restaurant format
        const restaurants = results.slice(0, 30).map(place => {
            // Extract cuisine/tags from types
            const tags = place.types
                ?.filter(t => !['point_of_interest', 'establishment', 'food'].includes(t))
                .map(t => t.replace(/_/g, ' '))
                .slice(0, 4) || [];
            
            // Add price level as tag
            if (place.price_level) {
                const priceTag = '$'.repeat(place.price_level);
                tags.push(priceTag);
            }
            
            // Determine cuisine from types or name
            let cuisine = 'Restaurant';
            if (tags.length > 0) {
                cuisine = tags[0].charAt(0).toUpperCase() + tags[0].slice(1);
            }
            
            return {
                placeId: place.place_id,
                name: place.name,
                address: place.vicinity || '',
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
                rating: place.rating || 0,
                totalRatings: place.user_ratings_total || 0,
                cuisine: cuisine,
                tags: tags,
                url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
                isOpen: place.opening_hours?.open_now
            };
        });
        
        return restaurants.length > 0 ? restaurants : getMockGooglePlacesData(location);
        
    } catch (error) {
        console.warn("Google Places API not available, using mock data");
        console.warn("To enable: Go to Google Cloud Console → APIs & Services → Enable 'Places API'");
        console.warn("Error:", error.message);
        return getMockGooglePlacesData(location);
    }
}

// Keep mock functions as fallback
async function getMockHotspotData() {
    const mockData = [
        { id: 1, name: "Williamsburg Waterfront", address: "Williamsburg, Brooklyn, NY", lat: 40.716, lng: -73.96, review_count: 9500, tags: ["pizza", "brunch", "bars", "trendy", "views"] },
        { id: 2, name: "Downtown Brooklyn", address: "Downtown, Brooklyn, NY", lat: 40.692, lng: -73.987, review_count: 8200, tags: ["food hall", "quick eats", "cheesecake", "shopping"] },
        { id: 3, name: "Greenpoint", address: "Greenpoint, Brooklyn, NY", lat: 40.730, lng: -73.95, review_count: 6100, tags: ["polish", "donuts", "cozy", "pierogis"] },
        { id: 4, name: "Bushwick", address: "Bushwick, Brooklyn, NY", lat: 40.697, lng: -73.92, review_count: 7300, tags: ["tacos", "vegan", "breweries", "latin", "art"] },
        { id: 5, name: "Park Slope", address: "Park Slope, Brooklyn, NY", lat: 40.672, lng: -73.98, review_count: 5500, tags: ["family", "ice cream", "thai", "italian", "cozy"] },
        { id: 6, name: "DUMBO", address: "DUMBO, Brooklyn, NY", lat: 40.703, lng: -73.99, review_count: 9100, tags: ["pizza", "ice cream", "views", "expensive", "lobster"] },
        { id: 7, name: "Sunset Park (Chinatown)", address: "Sunset Park, Brooklyn, NY", lat: 40.645, lng: -74.00, review_count: 7900, tags: ["dim sum", "chinese", "vietnamese", "spicy", "authentic"] },
        { id: 9, name: "Flushing, Queens", address: "Flushing, Queens, NY", lat: 40.759, lng: -73.83, review_count: 12500, tags: ["authentic", "chinese", "korean", "spicy", "hot pot", "food court"] },
        { id: 10, name: "East Village", address: "East Village, Manhattan, NY", lat: 40.726, lng: -73.98, review_count: 11000, tags: ["japanese", "ramen", "bars", "noodles", "ukrainian"] }
    ];
    return mockData;
}

async function getMockGooglePlacesData(location) {
    const mockData = [
        { placeId: "ChIJN1t_tDeuEmsRUsoyG83frY4", name: "The Cozy Corner", address: "123 Main St, Brooklyn, NY", tags: ["comfort food", "cozy", "american", "bistro"], cuisine: "American", url: "https://example.com" },
        { placeId: "ChIJU-P-mDeuEmsR5d-Gq-g", name: "Spicy Dragon", address: "456 Flatbush Ave, Brooklyn, NY", tags: ["spicy", "chinese", "sichuan", "adventurous"], cuisine: "Chinese", url: "https://example.com" },
        { placeId: "ChIJb8R-mDeuEmsR9a-Gq-g", name: "Pronto Pizza", address: "789 Atlantic Ave, Brooklyn, NY", tags: ["pizza", "quick", "cheap", "classic"], cuisine: "Pizza", url: "https://example.com" },
        { placeId: "ChIJf8R-mDeuEmsR9a-Gq-h", name: "Verdure", address: "321 Smith St, Brooklyn, NY", tags: ["vegan", "healthy", "upscale", "modern"], cuisine: "Vegan", url: "https://example.com" },
        { placeId: "ChIJe8R-mDeuEmsR9a-Gq-i", name: "El Toro Loco", address: "654 Court St, Brooklyn, NY", tags: ["mexican", "tacos", "lively", "fun", "groups"], cuisine: "Mexican", url: "https://example.com" },
        { placeId: "ChIJN1t_tDeuEmsRUsoyG83frY5", name: "Grimaldi's Pizza", address: "1 Front St, Brooklyn, NY", tags: ["pizza", "views", "expensive", "classic"], cuisine: "Pizza", url: "https://example.com" },
        { placeId: "ChIJU-P-mDeuEmsR5d-Gq-h", name: "Joe's Steam Rice Roll", address: "40-02 138th St, Flushing, NY", tags: ["chinese", "authentic", "quick eats", "food court"], cuisine: "Chinese", url: "https://example.com" },
        { placeId: "ChIJb8R-mDeuEmsR9a-Gq-j", name: "Hometown Bar-B-Que", address: "454 Van Brunt St, Brooklyn, NY", tags: ["bbq", "seafood", "american", "views"], cuisine: "BBQ", url: "https://example.com" }
    ];
    return mockData;
}

/**
 * AI Job 1: Filter Hotspots
 */
async function getAiFilteredHotspots(mood, cravings, userProfile, allHotspots, cache) {
    const cacheKey = `hotspots-${mood}-${cravings}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    try {
        // Use backend API instead of direct Gemini call
        const apiUrl = `${ENV.apiUrl}/ai/filter-hotspots`;

        const payload = {
            mood,
            cravings,
            profile: userProfile,
            hotspots: allHotspots
        };
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("Backend API error:", errorData);
            // If backend returns fallback flag, use local fallback
            if (errorData.fallback) {
                throw new Error("Backend using fallback");
            }
            throw new Error(`Backend API failed: ${response.status}`);
        }
        
        const result = await response.json();
        const filteredHotspots = result.hotspots || [];
        
        cache.set(cacheKey, filteredHotspots);
        setTimeout(() => cache.delete(cacheKey), 300000);
        return filteredHotspots;
    } catch (error) {
        console.warn("AI filtering failed, using local filtering:", error.message);
        // Fallback: Enhanced score-based filtering to get more results
        const moodLower = mood.toLowerCase();
        const cravingsLower = cravings.toLowerCase();
        const moodWords = moodLower.split(/\s+/).filter(w => w.length > 2);
        const cravingsWords = cravingsLower.split(/\s+/).filter(w => w.length > 2);
        
        const scored = allHotspots.map(h => {
            let score = 0;
            
            // Check tags for direct matches (weight 2)
            if (h.tags) {
                h.tags.forEach(tag => {
                    const tagLower = tag.toLowerCase();
                    cravingsWords.forEach(word => {
                        if (tagLower.includes(word) || word.includes(tagLower)) score += 2;
                    });
                    moodWords.forEach(word => {
                        if (tagLower.includes(word) || word.includes(tagLower)) score += 1.5;
                    });
                });
            }
            
            // Check name for matches (weight 3 for cravings, 2 for mood)
            const nameLower = h.name.toLowerCase();
            cravingsWords.forEach(word => {
                if (nameLower.includes(word) || word.includes(nameLower.split(/\s+/)[0])) score += 3;
            });
            moodWords.forEach(word => {
                if (nameLower.includes(word)) score += 2;
            });
            
            // Bonus for high review count (popularity signal)
            if (h.review_count > 8000) score += 2;
            else if (h.review_count > 6000) score += 1;
            
            // If no specific matches, give a base score for popular places
            if (score === 0) score = Math.log(h.review_count || 1) / 10;
            
            return { ...h, score };
        }).sort((a, b) => b.score - a.score);
        
        // Return all hotspots sorted by score to maximize suggestions
        const filtered = scored.map(({ score, ...h }) => h);
        cache.set(cacheKey, filtered);
        return filtered;
    }
}

/**
 * AI Job 2: Rank Restaurants
 */
async function getAiRankedRestaurants(mood, cravings, userProfile, allRestaurants, cache) {
    const cacheKey = `restaurants-${mood}-${cravings}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    try {
        // Use backend API instead of direct Gemini call
        const apiUrl = `${ENV.apiUrl}/ai/rank-restaurants`;

        const payload = {
            mood,
            cravings,
            profile: userProfile,
            restaurants: allRestaurants
        };
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("Backend API error:", errorData);
            // If backend returns fallback flag, use local fallback
            if (errorData.fallback) {
                throw new Error("Backend using fallback");
            }
            throw new Error(`Backend API failed: ${response.status}`);
        }
        
        const result = await response.json();
        // Backend returns restaurants with aiReasoning field
        const rankedRestaurants = result.restaurants || [];
        
        // Convert to the format expected by the rest of the code
        const suggestions = rankedRestaurants.map(r => ({
            placeId: r.placeId,
            reasoning: r.aiReasoning || `${r.name} - ${r.cuisine}`
        }));
        
        cache.set(cacheKey, suggestions);
        setTimeout(() => cache.delete(cacheKey), 300000);
        return suggestions;
    } catch (error) {
        console.warn("AI ranking failed, using local ranking:", error.message);
        // Fallback: Smarter scoring to return matching restaurants
        const moodLower = mood.toLowerCase().trim();
        const cravingsLower = cravings.toLowerCase().trim();
        
        // Better word splitting that handles phrases like "spicy pizza"
        const moodWords = moodLower.split(/\s+/).filter(w => w.length > 2);
        const cravingsWords = cravingsLower.split(/\s+/).filter(w => w.length > 2);
        
        const scored = allRestaurants.map(r => {
            let score = 0;
            let reasoningParts = [];
            let hasDirectMatch = false;
            
            // Check tags for matches
            if (r.tags && r.tags.length > 0) {
                const matchedTags = [];
                r.tags.forEach(tag => {
                    const tagLower = tag.toLowerCase();
                    
                    // Strong matches (craving words in tags) - check both directions
                    cravingsWords.forEach(word => {
                        if (tagLower.includes(word) || word.includes(tagLower)) {
                            score += 3;
                            hasDirectMatch = true;
                            if (!matchedTags.includes(tag)) matchedTags.push(tag);
                        }
                    });
                    
                    // Also check if full craving phrase matches
                    if (tagLower.includes(cravingsLower) || cravingsLower.includes(tagLower)) {
                        score += 4;  // Bonus for exact phrase match
                        hasDirectMatch = true;
                        if (!matchedTags.includes(tag)) matchedTags.push(tag);
                    }
                    
                    // Mood matches (secondary priority)
                    moodWords.forEach(word => {
                        if (tagLower.includes(word) || word.includes(tagLower)) {
                            score += 1.5;
                            if (!matchedTags.includes(tag)) matchedTags.push(tag);
                        }
                    });
                });
                
                if (matchedTags.length > 0) {
                    reasoningParts.push("serves " + matchedTags.join(", "));
                }
            }
            
            // Check name for craving matches (but lower priority than tags)
            const nameLower = r.name.toLowerCase();
            cravingsWords.forEach(word => {
                if (nameLower.includes(word)) {
                    score += 2;
                    hasDirectMatch = true;
                    if (!reasoningParts.some(p => p.includes("serves"))) {
                        reasoningParts.push("specializes in " + word);
                    }
                }
            });
            
            // Also check full craving phrase in name
            if (nameLower.includes(cravingsLower)) {
                score += 3;
                hasDirectMatch = true;
            }
            
            // Check if any cuisine tags are present (fallback)
            if (score === 0 && r.tags) {
                const foodTags = r.tags.filter(t => 
                    ['pizza', 'chinese', 'mexican', 'bbq', 'vegan', 'sushi', 'burger', 'thai', 'italian', 'spicy'].some(ft => t.toLowerCase().includes(ft))
                );
                if (foodTags.length > 0) {
                    score = 0.1;  // Very low priority match
                    reasoningParts.push("serves " + foodTags[0]);
                }
            }
            
            // Generate reasoning
            let reasoning = r.name;
            if (reasoningParts.length > 0) {
                reasoning += " - " + reasoningParts.slice(0, 2).join(" & ");
            } else {
                reasoning += " - " + (r.tags && r.tags.length > 0 ? r.tags.slice(0, 2).join(", ") : "");
            }
            
            return {
                placeId: r.placeId,
                reasoning: reasoning,
                score: score,
                hasDirectMatch: hasDirectMatch
            };
        })
        // PRIORITIZE direct matches
        .sort((a, b) => {
            // First, sort by direct match status
            if (a.hasDirectMatch && !b.hasDirectMatch) return -1;
            if (!a.hasDirectMatch && b.hasDirectMatch) return 1;
            // Then by score
            return b.score - a.score;
        })
        // Include results with a meaningful score
        .filter(r => r.score > 0);
        
        const suggestions = scored.map(({ placeId, reasoning }) => ({ 
            placeId, 
            reasoning: reasoning.substring(0, 120)
        }));
        
        console.log("Fallback suggestions count:", suggestions.length, "for search:", mood, cravings, "from", allRestaurants.length, "restaurants");
        
        cache.set(cacheKey, suggestions);
        return suggestions;
        
        cache.set(cacheKey, suggestions);
        return suggestions;
    }
}


// --- 9. Style Injection ---
// This component injects the global styles into the document head
function StyleInjector() {
    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            :root {
                font-family: 'Inter', sans-serif;
            }
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
            
            body {
                @apply h-full bg-gray-900 text-gray-200 antialiased;
            }

            /* Custom scrollbar */
            ::-webkit-scrollbar {
                width: 8px;
            }
            ::-webkit-scrollbar-track {
                background: #1f2937; /* gray-800 */
            }
            ::-webkit-scrollbar-thumb {
                background: #4f46e5; /* indigo-600 */
                border-radius: 4px;
            }
            ::-webkit-scrollbar-thumb:hover {
                background: #4338ca; /* indigo-700 */
            }

            /* Modal backdrop */
            .modal-backdrop {
                background-color: rgba(0, 0, 0, 0.75);
                backdrop-filter: blur(8px);
            }
            
            /* Custom gradient text */
            .gradient-text {
                background-image: linear-gradient(to right, #818cf8, #c084fc);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }

            /* Tab styles */
            .tab-btn {
                @apply flex-1 py-3 px-4 text-center font-bold text-gray-400 border-b-2 border-gray-700 transition-all duration-300;
            }
            .tab-btn:hover {
                @apply bg-gray-800 text-white;
            }
            .tab-btn.active {
                @apply text-indigo-400 border-indigo-500;
            }
        `;
        document.head.appendChild(style);
        return () => {
            document.head.removeChild(style);
        };
    }, []);
    return null;
}