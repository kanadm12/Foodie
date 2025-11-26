/**
 * API service layer for production
 * Handles all backend communication with proper error handling
 */

import ENV from '../config/environment';
import { ERROR_MESSAGES } from '../utils/constants';

class APIError extends Error {
    constructor(message, status, data) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.data = data;
    }
}

const handleResponse = async (response) => {
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new APIError(
            error.message || ERROR_MESSAGES.GENERIC,
            response.status,
            error
        );
    }
    return response.json();
};

const apiRequest = async (endpoint, options = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    try {
        const response = await fetch(`${ENV.apiUrl}${endpoint}`, {
            ...options,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });
        
        clearTimeout(timeoutId);
        return await handleResponse(response);
    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            throw new APIError(ERROR_MESSAGES.TIMEOUT, 408, {});
        }
        
        if (error instanceof APIError) {
            throw error;
        }
        
        throw new APIError(ERROR_MESSAGES.NETWORK, 0, {});
    }
};

export const api = {
    // AI Services - calls backend to protect API keys
    filterHotspots: async (mood, cravings, profile, hotspots) => {
        return apiRequest('/ai/filter-hotspots', {
            method: 'POST',
            body: JSON.stringify({ mood, cravings, profile, hotspots }),
        });
    },
    
    rankRestaurants: async (mood, cravings, profile, restaurants) => {
        return apiRequest('/ai/rank-restaurants', {
            method: 'POST',
            body: JSON.stringify({ mood, cravings, profile, restaurants }),
        });
    },
    
    // Reviews
    getReviews: async (placeId) => {
        return apiRequest(`/reviews/${placeId}`);
    },
    
    addReview: async (reviewData) => {
        return apiRequest('/reviews', {
            method: 'POST',
            body: JSON.stringify(reviewData),
        });
    },
    
    // Groups
    getGroups: async () => {
        return apiRequest('/groups');
    },
    
    createGroup: async (groupData) => {
        return apiRequest('/groups', {
            method: 'POST',
            body: JSON.stringify(groupData),
        });
    },
    
    joinGroup: async (groupId, userData) => {
        return apiRequest(`/groups/${groupId}/join`, {
            method: 'POST',
            body: JSON.stringify(userData),
        });
    },
};

export default api;
