import { db, createBooking, getUserBalances } from './firebase';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore/lite';
import axios from 'axios';

async function runTest() {
  const testUserId = 'test-premature-user-' + Date.now();
  const testProviderId = 'test-premature-service-' + Date.now();
  const testProviderUserId = 'test-premature-provider-user-' + Date.now();

  console.log("=== EARLY DISPUTE GUARD TEST ===");
  console.log(`Test Customer User ID: ${testUserId}`);
  console.log(`Test Service ID: ${testProviderId}\n`);

  let bookingId = '';
  try {
    // 1. Setup user & service
    await setDoc(doc(db, 'users', testUserId), {
      name: "Test Premature Customer",
      walletBalance: 5000,
      holdingBalance: 0
    });

    await setDoc(doc(db, 'services', testProviderId), {
      providerName: "Test Premature Provider",
      providerId: testProviderUserId,
      earnings: 0,
      price: 1500,
      reliabilityScore: 100,
      cancellations: 0,
      isActive: true
    });

    // 2. Create future booking (Scheduled 2 hours from now)
    const futureDate = new Date(Date.now() + 2 * 3600 * 1000);
    console.log(`Step 1: Creating future booking scheduled for: ${futureDate.toISOString()}...`);
    
    bookingId = await createBooking(testUserId, testProviderId, { 
      price: 1500, 
      date: `Future Booking, ${futureDate.toLocaleTimeString()}` 
    });

    // Manually force scheduledTimestamp into the future to be safe
    const bookingRef = doc(db, 'bookings', bookingId);
    await setDoc(bookingRef, {
      scheduledTimestamp: Date.now() + 2 * 3600 * 1000
    }, { merge: true });

    console.log(`Created booking ID: ${bookingId}`);

    // 3. Make POST request to local API endpoint /api/disputes
    console.log("\nStep 2: Submitting a No-Show dispute prematurely to the backend API...");
    
    const response = await axios.post('http://localhost:5000/api/disputes', {
      bookingId: bookingId,
      issueType: 'no_show',
      details: 'Provider never arrived (premature dispute test)'
    });

    console.log("Backend Response status:", response.status);
    console.log("Backend Response data:", JSON.stringify(response.data, null, 2));

    const data = response.data;
    if (data.success && data.isValid === false && data.action === 'rejected' && data.verdict.includes("scheduled time abhi nahi aaya")) {
      console.log("\n=================================================");
      console.log("🎉 SUCCESS: Early Dispute Guard blocked the premature dispute!");
      console.log("=================================================");
    } else {
      throw new Error("Early Dispute Guard failed to block the premature complaint!");
    }

  } catch (err: any) {
    console.error("\n❌ TEST FAILED:", err.response?.data || err.message || err);
    process.exit(1);
  } finally {
    // Cleanup
    if (bookingId) {
      console.log("\nCleaning up booking doc...");
      await deleteDoc(doc(db, 'bookings', bookingId));
    }
    await deleteDoc(doc(db, 'users', testUserId));
    await deleteDoc(doc(db, 'services', testProviderId));
    console.log("Cleanup done.");
  }
}

runTest();
