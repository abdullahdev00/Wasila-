import { db, createBooking, getUserBalances } from './firebase';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore/lite';
import axios from 'axios';

async function runTest() {
  const testUserId = 'test-chat-disp-user-' + Date.now();
  const testProviderId = 'test-chat-disp-service-' + Date.now();
  const testProviderUserId = 'test-chat-disp-prov-user-' + Date.now();

  console.log("=== CHUNK 1: CONVERSATIONAL DISPUTE RESOLUTION TEST ===");
  console.log(`Test Customer User ID: ${testUserId}`);
  console.log(`Test Service ID: ${testProviderId}`);
  console.log(`Test Provider User ID: ${testProviderUserId}\n`);

  let bookingId = '';
  try {
    // 1. Setup user & service
    await setDoc(doc(db, 'users', testUserId), {
      name: "Test Chat Dispute Customer",
      walletBalance: 5000,
      holdingBalance: 0
    });

    await setDoc(doc(db, 'users', testProviderUserId), {
      name: "Test Chat Provider User",
      walletBalance: 0,
      holdingBalance: 0
    });

    await setDoc(doc(db, 'services', testProviderId), {
      providerName: "Test Chat Provider",
      providerId: testProviderUserId,
      earnings: 0,
      price: 1500,
      reliabilityScore: 100,
      cancellations: 0,
      isActive: true
    });

    // 2. Create future booking (Scheduled 2 hours from now)
    const futureDate = new Date(Date.now() + 2 * 3600 * 1000);
    console.log("Step 1: Creating future booking scheduled for: " + futureDate.toISOString() + "...");
    bookingId = await createBooking(testUserId, testProviderId, { 
      price: 1500, 
      date: `Future Booking, ${futureDate.toLocaleTimeString()}` 
    });

    // Force scheduledTimestamp in the future
    await setDoc(doc(db, 'bookings', bookingId), {
      scheduledTimestamp: Date.now() + 2 * 3600 * 1000
    }, { merge: true });

    // 3. Test Case 1: Premature dispute check
    console.log("\nStep 2: Sending premature dispute message with booking ID in chat...");
    let response = await axios.post('http://localhost:5000/api/chat', {
      message: `plumber nahi aya booking ID ${bookingId} mery paise wapis kro please`,
      userId: testUserId,
      userName: "Test Chat Dispute Customer"
    });

    console.log("Chat API Response:", response.data.reply);
    if (!response.data.reply.includes("scheduled time abhi nahi aaya")) {
      throw new Error("Early Dispute Guard failed to block the premature chat dispute!");
    }
    console.log("✓ Early Dispute Guard successfully blocked the premature chat dispute.\n");

    // 4. Test Case 2: Dispute check past scheduled time (No-Show Alert)
    console.log("Step 3: Updating booking scheduled time to the past...");
    await setDoc(doc(db, 'bookings', bookingId), {
      scheduledTimestamp: Date.now() - 3600 * 1000,
      status: 'accepted'
    }, { merge: true });

    console.log("Sending dispute message with booking ID again in chat...");
    response = await axios.post('http://localhost:5000/api/chat', {
      message: `booking ID ${bookingId} ye provider abhi tak nahi aya`,
      userId: testUserId,
      userName: "Test Chat Dispute Customer"
    });

    console.log("Chat API Response:", response.data.reply);
    
    // Verify booking status changed to disputed_no_show
    const bookingSnap = await getDoc(doc(db, 'bookings', bookingId));
    const bookingStatus = bookingSnap.data()?.status;
    console.log(`Updated Booking Status: ${bookingStatus}`);

    if (bookingStatus !== 'disputed_no_show') {
      throw new Error("Booking status did not change to disputed_no_show!");
    }
    if (!response.data.reply.includes("confirm kar rahe hain")) {
      throw new Error("Chat response does not indicate provider response check!");
    }
    console.log("✓ Chat Dispute successfully triggered provider alert and updated booking status.\n");

    console.log("=================================================");
    console.log("🎉 SUCCESS: Conversational Dispute test passed!");
    console.log("=================================================");

  } catch (err: any) {
    console.error("\n❌ TEST FAILED:", err.response?.data || err.message || err);
    process.exit(1);
  } finally {
    // Cleanup
    if (bookingId) {
      console.log("\nCleaning up bookings...");
      await deleteDoc(doc(db, 'bookings', bookingId));
    }
    await deleteDoc(doc(db, 'users', testUserId));
    await deleteDoc(doc(db, 'users', testProviderUserId));
    await deleteDoc(doc(db, 'services', testProviderId));
    console.log("Cleanup done.");
  }
}

runTest();
