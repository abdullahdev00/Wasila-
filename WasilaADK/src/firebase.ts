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
  
  try {
    await holdBookingPayment(userId, docRef.id, finalPrice, providerId, providerName);
  } catch (err) {
    console.warn(`[createBooking] Failed to automatically place payment on hold for booking ${docRef.id}:`, err);
  }

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

export async function logTransaction(
  userId: string,
  userName: string,
  providerId: string,
  providerName: string,
  bookingId: string,
  amount: number,
  type: 'payment_hold' | 'payment_release' | 'refund' | 'deposit',
  description: string
): Promise<string> {
  try {
    if (!userId || userId === 'guest') {
      console.log(`[logTransaction] Skipping logging transaction for guest: ${userId}`);
      return 'skipped';
    }
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    let existingTransactions: any[] = [];
    if (userSnap.exists()) {
      existingTransactions = userSnap.data().transactions || [];
    }

    const txId = 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const newTransaction = {
      id: txId,
      userId,
      userName,
      providerId,
      providerName,
      bookingId,
      amount,
      type,
      description,
      timestamp: new Date().toISOString()
    };

    const updatedTransactions = [newTransaction, ...existingTransactions].slice(0, 50);

    await setDoc(userRef, {
      transactions: updatedTransactions
    }, { merge: true });

    console.log(`[Transaction Logged] User: ${userName} | Type: ${type} | Amount: Rs. ${amount}`);
    return txId;
  } catch (err) {
    console.error(`[logTransaction] Error logging transaction:`, err);
    throw err;
  }
}

export async function holdBookingPayment(
  userId: string,
  bookingId: string,
  price: number,
  providerId: string,
  providerName: string
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    let walletBalance = 5000;
    let holdingBalance = 0;
    let userName = 'Guest User';

    if (userSnap.exists()) {
      const data = userSnap.data();
      walletBalance = data.walletBalance !== undefined ? data.walletBalance : 5000;
      holdingBalance = data.holdingBalance !== undefined ? data.holdingBalance : 0;
      userName = data.name || userName;
    }

    const newWalletBalance = walletBalance - price;
    const newHoldingBalance = holdingBalance + price;

    await setDoc(userRef, {
      walletBalance: newWalletBalance,
      holdingBalance: newHoldingBalance
    }, { merge: true });

    const bookingRef = doc(db, 'bookings', bookingId);
    await updateDoc(bookingRef, {
      paymentStatus: 'holding'
    });

    await logTransaction(
      userId,
      userName,
      providerId,
      providerName,
      bookingId,
      price,
      'payment_hold',
      `Rs. ${price.toLocaleString()} hold set for service with ${providerName}`
    );
    console.log(`[Wallet ESCROW Hold] Deducted Rs. ${price} from ${userName}'s wallet. New Wallet: Rs. ${newWalletBalance}, New Holding: Rs. ${newHoldingBalance}`);
  } catch (err) {
    console.error(`[holdBookingPayment] Failed to hold booking payment for user ${userId}:`, err);
    throw err;
  }
}

export async function releaseBookingPayment(
  userId: string,
  bookingId: string,
  price: number,
  providerId: string,
  providerName: string
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    let holdingBalance = 0;
    let userName = 'Guest User';

    if (userSnap.exists()) {
      const data = userSnap.data();
      holdingBalance = data.holdingBalance !== undefined ? data.holdingBalance : 0;
      userName = data.name || userName;
    }

    const newHoldingBalance = Math.max(0, holdingBalance - price);

    await setDoc(userRef, {
      holdingBalance: newHoldingBalance
    }, { merge: true });

    const serviceRef = doc(db, 'services', providerId);
    const serviceSnap = await getDoc(serviceRef);
    let currentEarnings = 0;
    if (serviceSnap.exists()) {
      currentEarnings = serviceSnap.data().earnings || 0;
      await updateDoc(serviceRef, {
        earnings: currentEarnings + price
      });
    }

    const bookingRef = doc(db, 'bookings', bookingId);
    await updateDoc(bookingRef, {
      paymentStatus: 'released'
    });

    await logTransaction(
      userId,
      userName,
      providerId,
      providerName,
      bookingId,
      price,
      'payment_release',
      `Rs. ${price.toLocaleString()} released to provider ${providerName}`
    );
    console.log(`[Wallet ESCROW Release] Released Rs. ${price} hold funds to ${providerName}. New Customer Holding: Rs. ${newHoldingBalance}`);
  } catch (err) {
    console.error(`[releaseBookingPayment] Failed to release payment:`, err);
    throw err;
  }
}

export async function refundBookingPayment(
  userId: string,
  bookingId: string,
  price: number,
  providerId: string,
  providerName: string
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    let walletBalance = 5000;
    let holdingBalance = 0;
    let userName = 'Guest User';

    if (userSnap.exists()) {
      const data = userSnap.data();
      walletBalance = data.walletBalance !== undefined ? data.walletBalance : 5000;
      holdingBalance = data.holdingBalance !== undefined ? data.holdingBalance : 0;
      userName = data.name || userName;
    }

    const newHoldingBalance = Math.max(0, holdingBalance - price);
    const newWalletBalance = walletBalance + price;

    await setDoc(userRef, {
      walletBalance: newWalletBalance,
      holdingBalance: newHoldingBalance
    }, { merge: true });

    const bookingRef = doc(db, 'bookings', bookingId);
    await updateDoc(bookingRef, {
      paymentStatus: 'refunded'
    });

    await logTransaction(
      userId,
      userName,
      providerId,
      providerName,
      bookingId,
      price,
      'refund',
      `Rs. ${price.toLocaleString()} refunded for cancellation of booking with ${providerName}`
    );
    console.log(`[Wallet ESCROW Refund] Refunded Rs. ${price} back to ${userName}'s wallet. New Wallet: Rs. ${newWalletBalance}, New Holding: Rs. ${newHoldingBalance}`);
  } catch (err) {
    console.error(`[refundBookingPayment] Failed to refund payment:`, err);
    throw err;
  }
}

export async function getUserBalances(userId: string) {
  if (!userId || userId === 'guest' || userId.startsWith('test-user-')) {
    return { walletBalance: 5000, holdingBalance: 0 };
  }
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      const walletBalance = data.walletBalance !== undefined ? data.walletBalance : 5000;
      const holdingBalance = data.holdingBalance !== undefined ? data.holdingBalance : 0;
      
      if (data.walletBalance === undefined || data.holdingBalance === undefined) {
        await setDoc(userRef, { walletBalance, holdingBalance }, { merge: true });
      }
      
      return { walletBalance, holdingBalance };
    }
  } catch (err) {
    console.warn(`[getUserBalances] Failed to fetch balances for ${userId}:`, err);
  }
  return { walletBalance: 5000, holdingBalance: 0 };
}

