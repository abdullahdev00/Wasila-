import { db, createBooking, getUserBalances } from './firebase';
import { doc, setDoc, getDoc, updateDoc, collection, getDocs, query, where, deleteDoc } from 'firebase/firestore/lite';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

// Helper function to retry Firestore operations in case of transient network drops
async function retryDb<T>(operation: () => Promise<T>, maxRetries = 4, delayMs = 1500): Promise<T> {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      return await operation();
    } catch (err: any) {
      console.warn(`[Firestore Test Retry] Attempt ${i}/${maxRetries} failed: ${err.message}. Retrying in ${delayMs}ms...`);
      if (i === maxRetries) throw err;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error("Retry failed");
}

async function runTest() {
  const testUserId = 'test-interactive-user-' + Date.now();
  const testPrimaryServiceId = 'test-primary-service-' + Date.now();
  const testPrimaryProviderUserId = 'test-primary-prov-user-' + Date.now();
  
  const testBackupServiceId = 'test-backup-service-' + Date.now();
  const testBackupProviderUserId = 'test-backup-prov-user-' + Date.now();

  console.log("=== CHUNK 1 INTERACTIVE FLOW: NO-SHOW DISPUTE WITH PROVIDER PROMPT ===");
  console.log(`Test Customer User ID: ${testUserId}`);
  console.log(`Test Primary Service ID: ${testPrimaryServiceId}`);
  console.log(`Test Backup Service ID: ${testBackupServiceId}\n`);

  try {
    // 1. Setup customer and provider documents in Firestore
    console.log("Step 1: Setting up users and services in Firestore...");
    await retryDb(() => setDoc(doc(db, 'users', testUserId), {
      name: "Mohammad Ahmad",
      walletBalance: 5000,
      holdingBalance: 0
    }));

    // Primary Provider
    await retryDb(() => setDoc(doc(db, 'services', testPrimaryServiceId), {
      name: "AC Repair Islamabad",
      providerName: "Shafeeq Technician",
      providerId: testPrimaryProviderUserId,
      earnings: 0,
      price: 1500,
      reliabilityScore: 100,
      cancellations: 0,
      isActive: true,
      category: "Repair",
      location: "Islamabad"
    }));

    // Backup Provider
    await retryDb(() => setDoc(doc(db, 'services', testBackupServiceId), {
      name: "AC Maintenance Islamabad",
      providerName: "Yasir Expert",
      providerId: testBackupProviderUserId,
      earnings: 0,
      price: 1800,
      reliabilityScore: 100,
      cancellations: 0,
      isActive: true,
      category: "Repair",
      location: "Islamabad"
    }));

    // 2. Customer creates a booking with the Primary Provider (Price: Rs. 1500)
    console.log("Step 2: Placing booking of Rs. 1,500 with primary provider...");

    const bookingId = await createBooking(testUserId, testPrimaryServiceId, { 
      price: 1500, 
      date: 'Tomorrow, 10:00 AM' 
    });
    console.log(`Created booking ID: ${bookingId}`);

    // Verify initial hold balances
    let balances = await getUserBalances(testUserId);
    console.log(`Customer Balances after hold -> Wallet: Rs. ${balances.walletBalance}, Holding: Rs. ${balances.holdingBalance}`);

    // 3. Customer submits a 'no_show' dispute via the API
    console.log("\nStep 3: Customer reports 'no_show' dispute via API POST /api/disputes...");
    const disputeRes = await axios.post(`${API_BASE_URL}/disputes`, {
      bookingId: bookingId,
      issueType: 'no_show',
      details: 'Shafeeq Technician scheduled slot par nahi aya aur mobile bhi pick nahi kar raha.'
    });

    console.log("Dispute API Response:");
    console.log(JSON.stringify(disputeRes.data, null, 2));

    if (!disputeRes.data.pendingProviderResponse) {
      throw new Error("Dispute should have been intercepted as pending provider response!");
    }

    // Verify booking status changed to 'disputed_no_show' in Firestore
    const disputedBookingSnap = await retryDb(() => getDoc(doc(db, 'bookings', bookingId)));
    console.log(`Booking Status in Firestore: ${disputedBookingSnap.data()?.status}`);
    if (disputedBookingSnap.data()?.status !== 'disputed_no_show') {
      throw new Error("Booking status should be 'disputed_no_show'!");
    }

    // Verify a notification is logged for the primary provider
    const notifsCol = collection(db, 'notifications');
    const providerNotifs = await retryDb(() => getDocs(query(notifsCol, where('userId', '==', testPrimaryProviderUserId))));
    console.log(`Provider Notifications count: ${providerNotifs.size}`);
    if (providerNotifs.empty) {
      throw new Error("Provider should have received a no-show alert notification!");
    }
    console.log(`Provider Alert Message: "${providerNotifs.docs[0].data().message}"`);

    // 4. Provider responds 'no_go' (cannot come)
    console.log("\nStep 4: Provider clicks 'Nahi Jana / Cancel' (POST /api/bookings/:id/dispute-response)...");
    const responseRes = await axios.post(`${API_BASE_URL}/bookings/${bookingId}/dispute-response`, {
      response: 'no_go'
    });

    console.log("Provider Response API Output:");
    console.log(JSON.stringify(responseRes.data, null, 2));

    // 5. Verify final system state after cancellation and recovery
    console.log("\nStep 5: Verifying system database states after recovery...");

    // A. Original booking cancelled
    const finalBookingSnap = await retryDb(() => getDoc(doc(db, 'bookings', bookingId)));
    console.log(`Original Booking Status: ${finalBookingSnap.data()?.status}`);
    if (finalBookingSnap.data()?.status !== 'cancelled_by_dispute') {
      throw new Error("Original booking was not cancelled correctly!");
    }

    // B. Primary Provider penalized
    const primaryServiceSnap = await retryDb(() => getDoc(doc(db, 'services', testPrimaryServiceId)));
    console.log(`Primary Provider Reliability: ${primaryServiceSnap.data()?.reliabilityScore}% (Cancellations: ${primaryServiceSnap.data()?.cancellations})`);
    if (primaryServiceSnap.data()?.reliabilityScore !== 85) {
      throw new Error("Primary provider reliability was not penalized to 85%!");
    }

    // C. Customer balance updated (should have refunded Rs. 1500, but immediately auto-booked Yasir Expert at Rs. 1800)
    // Starting balance: 5000 (after refund). Deducted 1800 for backup booking.
    // Wallet should be: 3200, Holding should be: 1800.
    balances = await getUserBalances(testUserId);
    console.log(`Customer Wallet Balance: Rs. ${balances.walletBalance}, Holding: Rs. ${balances.holdingBalance}`);
    if (balances.walletBalance !== 3200 || balances.holdingBalance !== 1800) {
      throw new Error("Customer balances are incorrect after recovery auto-booking!");
    }

    // D. Backup booking created
    const bookingsCol = collection(db, 'bookings');
    const backupBookingsSnap = await retryDb(() => getDocs(query(bookingsCol, where('userId', '==', testUserId), where('providerId', '==', testBackupProviderUserId))));
    console.log(`Backup bookings created in Firestore: ${backupBookingsSnap.size}`);
    if (backupBookingsSnap.empty) {
      throw new Error("Backup booking was not created automatically!");
    }
    const backupBookingData = backupBookingsSnap.docs[0].data();
    console.log(`Backup Booking ID: ${backupBookingsSnap.docs[0].id}`);
    console.log(`Backup Booking Price: Rs. ${backupBookingData.price}`);
    console.log(`Backup Booking Status: ${backupBookingData.status}`);

    // E. Verify customer received recovery apology notification
    const customerNotifs = await retryDb(() => getDocs(query(notifsCol, where('userId', '==', testUserId), where('type', '==', 'recovery'))));
    console.log(`Customer Recovery Notifications count: ${customerNotifs.size}`);
    if (customerNotifs.empty) {
      throw new Error("Customer did not receive recovery apology notification!");
    }
    console.log(`Customer Notification Message: "${customerNotifs.docs[0].data().message}"`);

    // Clean up test documents
    console.log("\nCleaning up test documents from Firestore...");
    await retryDb(() => deleteDoc(doc(db, 'users', testUserId)));
    await retryDb(() => deleteDoc(doc(db, 'services', testPrimaryServiceId)));
    await retryDb(() => deleteDoc(doc(db, 'services', testBackupServiceId)));
    await retryDb(() => deleteDoc(doc(db, 'bookings', bookingId)));
    await retryDb(() => deleteDoc(doc(db, 'bookings', backupBookingsSnap.docs[0].id)));
    
    // Clean up notifications
    for (const d of providerNotifs.docs) await retryDb(() => deleteDoc(doc(db, 'notifications', d.id)));
    for (const d of customerNotifs.docs) await retryDb(() => deleteDoc(doc(db, 'notifications', d.id)));

    console.log("\n=========================================================");
    console.log("🎉 SUCCESS: Interactive Dispute Response test passed!");
    console.log("=========================================================");

  } catch (err: any) {
    console.error("\n❌ TEST FAILED:", err.response?.data || err.message || err);
    process.exit(1);
  }
}

runTest();
