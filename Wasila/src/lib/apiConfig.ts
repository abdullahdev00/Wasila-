/**
 * Wasila API Configuration
 * Always connects to the deployed Cloud Run backend (works in both Dev + Prod)
 */

export const API_BASE_URL = 'http://10.88.207.158:5000/api';

console.log(`🔗 Wasila AI Backend (Local mobile test) → ${API_BASE_URL}`);
