import Constants from 'expo-constants';

/**
 * Wasila API Configuration
 * Automatically detects the local IP address of the development machine.
 * Works for both friends without hardcoding IPs!
 */

// Get the local IP address from Expo's host URI
const debuggerHost = Constants.expoConfig?.hostUri || '';
const localIp = debuggerHost.split(':').shift() || 'localhost';

export const API_BASE_URL = 'https://wasila-backend-340241029103.us-central1.run.app/api';

console.log('🔗 Wasila AI Backend connected to:', API_BASE_URL);
