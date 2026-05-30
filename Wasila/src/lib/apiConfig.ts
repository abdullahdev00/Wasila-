import Constants from 'expo-constants';

/**
 * Wasila API Configuration
 * - Expo Go / dev mode  → connects to local backend via LAN IP
 * - Production APK      → connects to hosted Cloud Run backend
 */

const PRODUCTION_URL = 'https://wasila-backend-546907715054.us-central1.run.app/api';

// Expo injects hostUri only in dev mode (e.g. "192.168.1.27:8081")
const debuggerHost = Constants.expoConfig?.hostUri || '';
const localIp = debuggerHost.split(':').shift() || 'localhost';
const LOCAL_URL = `http://${localIp}:5000/api`;

export const API_BASE_URL = __DEV__ ? LOCAL_URL : PRODUCTION_URL;

console.log(`🔗 Wasila AI Backend [${__DEV__ ? 'DEV' : 'PROD'}] →`, API_BASE_URL);

