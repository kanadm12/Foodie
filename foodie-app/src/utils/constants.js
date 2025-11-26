/**
 * Application constants for production
 */

export const APP_CONFIG = {
    NAME: 'Foodie',
    VERSION: '1.0.0',
    MAX_RETRIES: 3,
    TIMEOUT: 10000, // 10 seconds
    CACHE_DURATION: 300000, // 5 minutes
};

export const API_ENDPOINTS = {
    AI_FILTER: '/ai/filter-hotspots',
    AI_RANK: '/ai/rank-restaurants',
    REVIEWS: '/reviews',
    GROUPS: '/groups',
};

export const ERROR_MESSAGES = {
    NETWORK: 'Network error. Please check your connection.',
    AUTH: 'Authentication failed. Please try again.',
    VALIDATION: 'Please check your input and try again.',
    GENERIC: 'Something went wrong. Please try again later.',
    TIMEOUT: 'Request timed out. Please try again.',
};

export const SUCCESS_MESSAGES = {
    PROFILE_SAVED: 'Profile saved successfully!',
    REVIEW_ADDED: 'Review added successfully!',
    GROUP_CREATED: 'Group created successfully!',
    GROUP_JOINED: 'Joined group successfully!',
};

export const ROUTES = {
    HOME: '/',
    PROFILE: '/profile',
    GROUPS: '/groups',
    RESTAURANT: '/restaurant/:id',
};

export const STORAGE_KEYS = {
    PROFILE: 'foodie_profile',
    CACHE_PREFIX: 'foodie_cache_',
    SEARCH_HISTORY: 'foodie_search_history',
};
