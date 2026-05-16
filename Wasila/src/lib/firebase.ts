import { initializeApp } from "firebase/app";
import { initializeAuth, getAuth } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// @ts-ignore - This module is added by npx expo install
import AsyncStorage from '@react-native-async-storage/async-storage';

// @ts-ignore - getReactNativePersistence is often missing from types but exists in RN bundle
import { getReactNativePersistence } from 'firebase/auth';

// Firebase configuration using environment variables for security
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with Persistence for React Native
let firebaseAuth;
try {
  firebaseAuth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (e) {
  // Fallback for web or if persistence fails to initialize
  firebaseAuth = getAuth(app);
}

export const auth = firebaseAuth;
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
