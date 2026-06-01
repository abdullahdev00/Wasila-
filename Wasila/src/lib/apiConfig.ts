/**
 * Wasila API Configuration
 * Always connects to the deployed Cloud Run backend (works in both Dev + Prod)
 */

export const API_BASE_URL = 'https://wasila-backend-546907715054.us-central1.run.app/api';

console.log(`🔗 Wasila AI Backend → ${API_BASE_URL}`);
