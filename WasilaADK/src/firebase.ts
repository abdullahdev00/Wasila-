import * as dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, doc, getDoc, setDoc, updateDoc, query, where, orderBy, limit } from 'firebase/firestore/lite';
import { parseBookingDateToTimestamp } from './utils/dateParser';

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

import { getApps, getApp } from 'firebase/app';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
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
        rating: data.rating !== undefined ? data.rating : 4.5,
        pricePerHour: data.price || 0,
        location: data.address || data.city || 'Islamabad',
        reliabilityScore: data.reliabilityScore !== undefined ? data.reliabilityScore : 100,
        lateArrivals: data.lateArrivals || 0,
        cancellations: data.cancellations || 0,
        totalCompletedBookings: data.totalCompletedBookings || 0,
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

  // Use custom price if provided (e.g. from negotiation)
  const finalPrice = (details?.price !== undefined && details?.price !== null) ? details.price : price;

  const newBooking = {
    userId,
    userName,
    userPhotoURL,
    serviceId: serviceDocId,
    serviceName,
    category,
    price: finalPrice,
    providerId,
    providerName,
    providerPhotoURL,
    status: 'pending',
    date: details?.date || 'Tomorrow, 10:00 AM', // Custom or default scheduling date/time
    scheduledTimestamp: parseBookingDateToTimestamp(details?.date || 'Tomorrow, 10:00 AM'),
    timestamp: new Date().toISOString(),
    notes: details?.notes || ''
  };
  
  console.log(`[Firebase Helper] Inserting booking doc with price ${finalPrice}:`, newBooking);
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

export async function saveChatSession(
  sessionId: string,
  userId: string,
  userName: string,
  messages: any[],
  metadata: {
    serviceId?: string;
    providerId?: string;
    providerName?: string;
    category?: string;
    lastMessage?: string;
  }
) {
  try {
    const chatDocRef = doc(db, 'chats', sessionId);
    const chatSnap = await getDoc(chatDocRef);
    
    // Fetch user photo URL if not already present
    let userPhotoURL = '';
    try {
      const userSnap = await getDoc(doc(db, 'users', userId));
      if (userSnap.exists()) {
        userPhotoURL = userSnap.data().photoURL || '';
      }
    } catch (e) {
      console.warn("Failed to fetch user photo for chat:", e);
    }

    const chatData: any = {
      id: sessionId,
      userId,
      userName,
      userPhotoURL,
      updatedAt: new Date().toISOString(),
      messages,
      ...metadata
    };

    // Remove undefined fields
    Object.keys(chatData).forEach(key => chatData[key] === undefined && delete chatData[key]);

    if (chatSnap.exists()) {
      await updateDoc(chatDocRef, chatData);
    } else {
      await setDoc(chatDocRef, {
        ...chatData,
        createdAt: new Date().toISOString()
      });
    }
    console.log(`[Firebase Helper] Chat session ${sessionId} saved successfully in Firestore.`);
  } catch (error) {
    console.error(`[saveChatSession] Error saving chat ${sessionId}:`, error);
  }
}

export async function fetchLastChatSession(userId: string) {
  try {
    const q = query(
      collection(db, 'chats'),
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docs = snap.docs.map(d => d.data());
      // Sort in memory by updatedAt descending to avoid composite index requirement
      docs.sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      });
      return docs[0];
    }
    return null;
  } catch (err: any) {
    console.error(`[fetchLastChatSession] Failed to fetch last chat session for ${userId}:`, err);
    return null;
  }
}

export async function cancelBooking(bookingId: string): Promise<void> {
  try {
    const bookingRef = doc(db, 'bookings', bookingId);
    console.log(`[Firebase Helper] Cancelling booking ID: ${bookingId}`);
    await updateDoc(bookingRef, { status: 'cancelled' });
  } catch (err) {
    console.error(`[cancelBooking] Failed to cancel booking ID ${bookingId}:`, err);
    throw err;
  }
}

