import * as dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, doc, getDoc } from 'firebase/firestore';

dotenv.config();

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
export const db = getFirestore(app);

export async function fetchProvidersFromFirebase() {
  const servicesCol = collection(db, 'services');
  const serviceSnapshot = await getDocs(servicesCol);
  const providers: any[] = [];
  
  serviceSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.isActive) {
      providers.push({
        id: doc.id,
        name: data.providerName || data.name,
        serviceName: data.name,
        category: data.category,
        rating: data.rating || 4.5,
        pricePerHour: data.price || 0,
        location: data.address || data.city || 'Islamabad',
        isBooked: false // Required for matchmaking
      });
    }
  });
  
  return providers;
}

export async function createBooking(userId: string, serviceDocId: string, details: any) {
  const bookingsCol = collection(db, 'bookings');
  
  // 1. Fetch customer details
  let userName = 'Guest User';
  let userPhotoURL = '';
  try {
    const userSnap = await getDoc(doc(db, 'users', userId));
    if (userSnap.exists()) {
      const userData = userSnap.data();
      userName = userData.name || 'Guest User';
      userPhotoURL = userData.photoURL || '';
    }
  } catch (err) {
    console.warn(`[createBooking] Failed to fetch customer details for UID: ${userId}`, err);
  }

  // 2. Fetch service/provider details
  let serviceName = 'Unknown Service';
  let category = 'General';
  let price = 0;
  let providerId = serviceDocId;
  let providerName = 'Professional';
  let providerPhotoURL = '';

  try {
    const serviceSnap = await getDoc(doc(db, 'services', serviceDocId));
    if (serviceSnap.exists()) {
      const serviceData = serviceSnap.data();
      serviceName = serviceData.name || 'Unknown Service';
      category = serviceData.category || 'General';
      price = serviceData.price || 0;
      providerId = serviceData.providerId || serviceDocId;
      providerName = serviceData.providerName || 'Professional';
      providerPhotoURL = serviceData.providerPhotoURL || '';
    }
  } catch (err) {
    console.warn(`[createBooking] Failed to fetch service details for ID: ${serviceDocId}`, err);
  }

  const newBooking = {
    userId,
    userName,
    userPhotoURL,
    serviceId: serviceDocId,
    serviceName,
    category,
    price,
    providerId,
    providerName,
    providerPhotoURL,
    status: 'pending',
    date: details?.date || 'Tomorrow, 10:00 AM', // Custom or default scheduling date/time
    timestamp: new Date().toISOString(),
    notes: details?.notes || ''
  };
  
  console.log(`[Firebase Helper] Inserting booking doc:`, newBooking);
  const docRef = await addDoc(bookingsCol, newBooking);
  return docRef.id;
}

export async function getUserName(userId: string): Promise<string> {
  if (!userId || userId === 'guest' || userId.startsWith('test-user-')) return 'Guest User';
  try {
    const userSnap = await getDoc(doc(db, 'users', userId));
    if (userSnap.exists()) {
      return userSnap.data().name || 'Guest User';
    }
  } catch (err) {
    console.warn(`[getUserName] Failed to fetch user name for UID: ${userId}`, err);
  }
  return 'Guest User';
}

export async function fetchUserBookings(userId: string): Promise<any[]> {
  if (!userId || userId === 'guest') return [];
  try {
    const bookingsCol = collection(db, 'bookings');
    const bookingsSnapshot = await getDocs(bookingsCol);
    const bookings: any[] = [];
    bookingsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.userId === userId) {
        bookings.push({
          id: doc.id,
          serviceName: data.serviceName || 'Unknown Service',
          providerName: data.providerName || 'Professional',
          status: data.status || 'pending',
          date: data.date || 'Tomorrow, 10:00 AM',
          price: data.price || 0
        });
      }
    });
    return bookings;
  } catch (err) {
    console.error(`[fetchUserBookings] Failed to query bookings for UID: ${userId}`, err);
    return [];
  }
}

