/**
 * Input validation utilities for production security
 */

export const validateName = (name) => {
    if (!name || typeof name !== 'string') return false;
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 50) return false;
    // Allow letters, spaces, hyphens, apostrophes
    return /^[a-zA-Z\s'-]+$/.test(trimmed);
};

export const validateAge = (age) => {
    const numAge = parseInt(age, 10);
    return !isNaN(numAge) && numAge >= 13 && numAge <= 120;
};

export const validateLocation = (location) => {
    if (!location || typeof location !== 'string') return false;
    const trimmed = location.trim();
    return trimmed.length >= 3 && trimmed.length <= 100;
};

export const validateSearchInput = (input) => {
    if (!input || typeof input !== 'string') return false;
    const trimmed = input.trim();
    if (trimmed.length < 2 || trimmed.length > 100) return false;
    // Prevent SQL injection, XSS
    const dangerous = /<script|javascript:|onerror|onclick/i;
    return !dangerous.test(trimmed);
};

export const sanitizeInput = (input) => {
    if (!input || typeof input !== 'string') return '';
    return input
        .trim()
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .substring(0, 200); // Limit length
};

export const validateGroupName = (name) => {
    if (!name || typeof name !== 'string') return false;
    const trimmed = name.trim();
    return trimmed.length >= 3 && trimmed.length <= 50;
};

export const validateReviewText = (text) => {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    return trimmed.length >= 10 && trimmed.length <= 1000;
};
