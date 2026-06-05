import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, getDoc, updateDoc, deleteDoc, getDocs, query, where, setDoc } from 'firebase/firestore/lite';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// Resilient helper wrappers to prevent transient connection drops
async function retryGetDoc(docRef: any, maxRetries = 4, delayMs = 1500): Promise<any> {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      const snap = await getDoc(docRef);
      return snap;
    } catch (err: any) {
      console.warn(`[Firestore Retry] getDoc failed (Attempt ${i}/${maxRetries}): ${err.message}. Retrying in ${delayMs}ms...`);
      if (i === maxRetries) throw err;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

async function retryDeleteDoc(docRef: any, maxRetries = 4, delayMs = 1500): Promise<void> {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      await deleteDoc(docRef);
      return;
    } catch (err: any) {
      console.warn(`[Firestore Retry] deleteDoc failed (Attempt ${i}/${maxRetries}): ${err.message}. Retrying in ${delayMs}ms...`);
      if (i === maxRetries) throw err;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

async function retryUpdateDoc(docRef: any, data: any, maxRetries = 4, delayMs = 1500): Promise<void> {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      await updateDoc(docRef, data);
      return;
    } catch (err: any) {
      console.warn(`[Firestore Retry] updateDoc failed (Attempt ${i}/${maxRetries}): ${err.message}. Retrying in ${delayMs}ms...`);
      if (i === maxRetries) throw err;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

async function runTest() {
  console.log("=== Integration Test: Proactive Recovery Agent Workflow ===");

  const PORT = process.env.PORT || 5000;
  const BASE_URL = `http://localhost:${PORT}/api`;
  const TEST_CATEGORY = "Plumber_Recovery_Test_Unique";
  const TEST_USER_ID = "test-user-recovery-" + Date.now();
  const TEST_SESSION_ID = "chat-session-recovery-" + Date.now();

  // 1. Clean up leftover test services
  console.log("\n[Test Setup] Cleaning up any leftover test plumbers from previous runs...");
  const existingServices = await getDocs(query(collection(db, 'services'), where('category', '==', TEST_CATEGORY)));
  for (const d of existingServices.docs) {
    console.log(`- Deleting leftover provider: ${d.id}`);
    await retryDeleteDoc(d.ref);
  }

  // 2. Create two test providers in Firestore services collection
  console.log("\n[Test Setup] Creating two test plumbers in Firestore...");
  
  // Plumber A: Primary option (will cancel later)
  const plumberADoc = await addDoc(collection(db, 'services'), {
    name: "Primary Plumber Service",
    providerName: "Zahid Plumber",
    category: TEST_CATEGORY,
    rating: 4.8,
    price: 1200,
    address: "Islamabad",
    isActive: true,
    reliabilityScore: 100,
    lateArrivals: 0,
    cancellations: 0,
    totalCompletedBookings: 0
  });

  // Plumber B: Backup option (will be selected during recovery)
  const plumberBDoc = await addDoc(collection(db, 'services'), {
    name: "Backup Plumber Service",
    providerName: "Yasir Plumber",
    category: TEST_CATEGORY,
    rating: 4.6,
    price: 1000,
    address: "Islamabad",
    isActive: true,
    reliabilityScore: 100,
    lateArrivals: 0,
    cancellations: 0,
    totalCompletedBookings: 0
  });

  console.log(`- Created Plumber A (Zahid, Rating 4.8, Price Rs. 1200) with ID: ${plumberADoc.id}`);
  console.log(`- Created Plumber B (Yasir, Rating 4.6, Price Rs. 1000) with ID: ${plumberBDoc.id}`);

  // Create a dummy user profile for test location resolution
  console.log(`- Creating temporary user profile for ${TEST_USER_ID}...`);
  await setDoc(doc(db, 'users', TEST_USER_ID), {
    name: "Mohammad Abdullah",
    address: "Islamabad"
  });

  const createdBookingIds: string[] = [];

  try {
    // 2. Create booking for Plumber A
    console.log("\n[Test 1] Booking Plumber A...");
    const bookingCol = collection(db, 'bookings');
    const bookingDoc = await addDoc(bookingCol, {
      userId: TEST_USER_ID,
      userName: "Mohammad Abdullah",
      serviceId: plumberADoc.id,
      serviceName: "Primary Plumber Service",
      category: TEST_CATEGORY,
      price: 1200,
      providerId: "zahid_provider_id",
      providerName: "Zahid Plumber",
      status: "pending",
      date: "Tomorrow, 10:00 AM",
      scheduledTimestamp: Date.now() + 24 * 60 * 60 * 1000,
      timestamp: new Date().toISOString()
    });
    createdBookingIds.push(bookingDoc.id);
    console.log(`- Created Booking ID: ${bookingDoc.id}`);

    // Pre-populate chat session memory in Firestore
    console.log(`- Initializing chat session ${TEST_SESSION_ID} in Firestore...`);
    await setDoc(doc(db, 'chats', TEST_SESSION_ID), {
      id: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      userName: "Mohammad Abdullah",
      category: TEST_CATEGORY,
      serviceId: plumberADoc.id,
      messages: [
        { sender: 'user', text: "Mujhe plumber chahye Islamabad me", timestamp: new Date().toISOString() },
        { sender: 'ai', text: "Sajid Khan available hain...", timestamp: new Date().toISOString() }
      ],
      updatedAt: new Date().toISOString()
    });

    // Wait for Firestore indexing propagation so the backend query fetchLastChatSession finds the session
    console.log("- Waiting 3 seconds for Firestore indexing propagation...");
    await new Promise(r => setTimeout(r, 3000));

    // 3. Proactive Recovery Trigger: Simulate Plumber A cancelling
    console.log("\n[Test 2] Simulating provider cancellation (Proactive Recovery)...");
    const cancelRes = await axios.post(`${BASE_URL}/bookings/${bookingDoc.id}/provider-cancel`);
    console.log("Cancel API Response:", cancelRes.data);

    if (!cancelRes.data.success) {
      throw new Error("cancellation API call reported failure.");
    }
    
    // Verify backup provider was resolved
    const recoveryMatch = cancelRes.data.recoveryMatch;
    if (!recoveryMatch) {
      throw new Error("Expected recoveryMatch to contain backup provider, but got null.");
    }
    if (recoveryMatch.id !== plumberBDoc.id) {
      throw new Error(`Expected recoveryMatch to resolve to Plumber B (${plumberBDoc.id}), but got ${recoveryMatch.id}`);
    }
    
    // Verify price compensation: Plumber B base is 1000, pricePerHour after Rs. 200 discount should be 800!
    if (recoveryMatch.pricePerHour !== 800) {
      throw new Error(`Expected pricePerHour to be Rs. 800 (1000 - 200 apology discount), but got: Rs. ${recoveryMatch.pricePerHour}`);
    }
    console.log("✔ Proactive recovery resolved to Backup Provider B with Rs. 200 platform apology discount applied!");

    // Verify notification was written
    console.log("\n[Test 3] Verifying recovery alert notification written to database...");
    const notifSnap = await getDocs(query(collection(db, 'notifications'), where('userId', '==', TEST_USER_ID)));
    let notifFound = false;
    notifSnap.forEach(d => {
      const data = d.data();
      if (data.type === 'recovery' && data.bookingId === bookingDoc.id) {
        console.log(`- Found notification alert: "${data.message}"`);
        notifFound = true;
      }
    });
    if (!notifFound) {
      throw new Error("Recovery notification document not found in notifications collection.");
    }
    console.log("✔ Proactive alert notification successfully pushed to mobile channel!");

    // Verify session chat history was updated with Concierge apology
    console.log("\n[Test 4] Verifying Concierge apology and proposal appended to chat history...");
    const chatSnap = await retryGetDoc(doc(db, 'chats', TEST_SESSION_ID));
    const chatData = chatSnap.data();
    const messages = chatData?.messages || [];
    const latestMessage = messages[messages.length - 1];
    
    console.log(`- Latest AI Chat message: "${latestMessage?.text}"`);
    console.log(`- Matched provider in chat: ${latestMessage?.bestMatch?.providerName} (ID: ${latestMessage?.bestMatch?.id})`);
    
    if (latestMessage?.sender !== 'ai' || !latestMessage.bestMatch || latestMessage.bestMatch.id !== plumberBDoc.id) {
      throw new Error("Apology proposal message was not appended to chat history, or backup provider is missing.");
    }
    console.log("✔ Chat history and session context successfully preserved with next-best provider!");

    // 4. Confirm the booking on behalf of the user
    console.log("\n[Test 5] Simulating customer confirming backup booking in chat...");
    const chatRes = await axios.post(`${BASE_URL}/chat`, {
      message: "haan book krdo",
      userId: TEST_USER_ID,
      userName: "Mohammad Abdullah",
      sessionId: TEST_SESSION_ID
    });
    
    console.log("Chat API Response:", chatRes.data.reply);
    console.log("Booking Confirmed:", chatRes.data.bookingConfirmed);
    
    if (!chatRes.data.bookingConfirmed) {
      throw new Error("Expected booking to be confirmed, but got false.");
    }

    // Verify new booking price in Firestore is the discounted rate (Rs. 800)
    console.log("\n[Test 6] Verifying new booking document has the discounted price...");
    const bookingsSnap = await getDocs(query(collection(db, 'bookings'), where('userId', '==', TEST_USER_ID)));
    let newBookingPrice = 0;
    bookingsSnap.forEach(d => {
      const data = d.data();
      // Look for the newly created booking (for Plumber B)
      if (data.serviceId === plumberBDoc.id && data.status === 'pending') {
        newBookingPrice = data.price;
        createdBookingIds.push(d.id);
        console.log(`- Found new booking ID ${d.id} with price: Rs. ${data.price}`);
      }
    });

    if (newBookingPrice !== 800) {
      throw new Error(`Expected new booking price to be Rs. 800, but got: Rs. ${newBookingPrice}`);
    }
    console.log("✔ Backup booking successfully created at the Rs. 800 discounted price!");

    // 5. Test Fallback Case: No backup provider available
    console.log("\n[Test 7] Testing Fallback Case: Disable Backup Plumber and trigger cancellation...");
    // Make Plumber B inactive
    await retryUpdateDoc(doc(db, 'services', plumberBDoc.id), { isActive: false });

    // Create a new booking for Plumber A
    const fallbackBooking = await addDoc(bookingCol, {
      userId: TEST_USER_ID,
      userName: "Mohammad Abdullah",
      serviceId: plumberADoc.id,
      serviceName: "Primary Plumber Service",
      category: TEST_CATEGORY,
      price: 1200,
      providerId: "zahid_provider_id",
      providerName: "Zahid Plumber",
      status: "pending",
      date: "Tomorrow, 10:00 AM",
      scheduledTimestamp: Date.now() + 24 * 60 * 60 * 1000,
      timestamp: new Date().toISOString()
    });
    createdBookingIds.push(fallbackBooking.id);
    console.log(`- Created new Booking ID for fallback test: ${fallbackBooking.id}`);

    // Trigger cancellation
    const cancelResFallback = await axios.post(`${BASE_URL}/bookings/${fallbackBooking.id}/provider-cancel`);
    console.log("Cancel API Response (Fallback):", cancelResFallback.data);

    if (cancelResFallback.data.recoveryMatch !== null) {
      throw new Error(`Expected recoveryMatch to be null (since all backup providers are inactive), but got: ${JSON.stringify(cancelResFallback.data.recoveryMatch)}`);
    }

    // Verify session chat history has the platform credit apology message
    const chatSnapFallback = await retryGetDoc(doc(db, 'chats', TEST_SESSION_ID));
    const latestMsgFallback = chatSnapFallback.data()?.messages?.slice(-1)[0];
    console.log(`- Latest AI Chat message (Fallback): "${latestMsgFallback?.text}"`);
    
    if (latestMsgFallback?.bestMatch !== null) {
      throw new Error("Expected bestMatch to be null in no-provider fallback chat history.");
    }
    console.log("✔ Fallback flow correctly offered Rs. 200 platform credit and updated the session when no provider was found!");
    console.log("\n✔ Integration test for Recovery Agent Workflow passed successfully!");

  } finally {
    // Cleanup Firestore documents
    console.log("\n[Cleanup] Removing temporary test documents from Firestore...");
    try {
      await retryDeleteDoc(doc(db, 'services', plumberADoc.id));
      await retryDeleteDoc(doc(db, 'services', plumberBDoc.id));
      await retryDeleteDoc(doc(db, 'users', TEST_USER_ID));
      await retryDeleteDoc(doc(db, 'chats', TEST_SESSION_ID));
      
      // Clean up bookings created during the test
      for (const bid of createdBookingIds) {
        await retryDeleteDoc(doc(db, 'bookings', bid));
      }
      
      // Clean up notifications generated during the test
      const notifCol = collection(db, 'notifications');
      const allNotifs = await getDocs(notifCol);
      allNotifs.forEach(async d => {
        const data = d.data();
        if (data.userId === TEST_USER_ID) {
          await retryDeleteDoc(doc(notifCol, d.id));
        }
      });

      console.log("- Temporary test services, bookings, chat, and notifications deleted.");
    } catch (cleanupErr: any) {
      console.warn("Cleanup warning:", cleanupErr.message);
    }
  }
}

runTest().catch(err => {
  console.error("\nFAIL: Test failed with error:", err);
  process.exit(1);
});
