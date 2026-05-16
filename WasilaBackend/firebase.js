require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const { getAuth, signInAnonymously } = require('firebase/auth');

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function fetchProvidersFromFirebase() {
  const servicesCol = collection(db, 'services');
  const serviceSnapshot = await getDocs(servicesCol);
  const providers = [];
  
  serviceSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.isActive) {
      providers.push({
        id: doc.id,
        name: data.providerName || data.name,
        serviceName: data.name,
        category: data.category,
        rating: data.rating || 4.5, // Default rating if missing
        pricePerHour: data.price || 0,
        distanceKm: 2.0, // Mock distance or calculate if lat/long present
        experienceYears: 5, // Mock experience
        verified: true,
        cancellationRate: 0,
        availabilityScore: 90,
        location: data.address || data.city || 'Islamabad',
        skills: [data.category],
        availability: '9 AM - 6 PM',
        imageUrl: data.imageUrl
      });
    }
  });
  
  return providers;
}

module.exports = { db, fetchProvidersFromFirebase };
