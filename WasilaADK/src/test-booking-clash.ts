import { db, createBooking, saveChatSession } from './firebase';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore/lite';

async function runTest() {
  const testUserId = 'test-clash-user-' + Date.now();
  const testProviderId = 'test-clash-service-' + Date.now();
  const testProviderUserId = 'test-clash-provider-user-' + Date.now();

  console.log("=== BOOKING SLOT CLASH AND SANITIZATION TEST ===");

  try {
    // 1. Setup mock customer profile with wallet balance
    console.log("Step 1: Setting up mock customer and service profile...");
    await setDoc(doc(db, 'users', testUserId), {
      name: "Test Clash Customer",
      walletBalance: 5000,
      holdingBalance: 0
    });

    await setDoc(doc(db, 'users', testProviderUserId), {
      name: "Test Clash Provider User",
      walletBalance: 0,
      holdingBalance: 0
    });

    await setDoc(doc(db, 'services', testProviderId), {
      providerName: "Test Clash Provider",
      providerId: testProviderUserId,
      price: 1000,
      category: "Plumber",
      isActive: true
    });

    // 2. Create the first booking (Tomorrow, 10:00 AM)
    console.log("Step 2: Creating first booking for Tomorrow, 10:00 AM...");
    const booking1Id = await createBooking(testUserId, testProviderId, {
      price: 1000,
      date: 'Tomorrow, 10:00 AM'
    });
    console.log(`First booking created successfully (ID: ${booking1Id})`);

    // 3. Attempt to create a clashing booking at the exact same slot
    console.log("\nStep 3: Attempting to book the same slot (Tomorrow, 10:00 AM) again...");
    try {
      await createBooking(testUserId, testProviderId, {
        price: 1000,
        date: 'Tomorrow, 10:00 AM'
      });
      throw new Error("FAIL: Slot conflict check failed! Booking was allowed on a busy slot.");
    } catch (err: any) {
      if (err.message.includes("is already booked/busy")) {
        console.log(`✓ Slot conflict correctly blocked second booking. Error message: "${err.message}"`);
      } else {
        throw err;
      }
    }

    // 4. Test saveChatSession deep sanitization of undefined values
    console.log("\nStep 4: Testing deep sanitization helper in saveChatSession...");
    const testSessionId = 'test-session-sanitizer-' + Date.now();
    const testMessages = [
      {
        sender: 'user',
        text: 'hello'
      },
      {
        sender: 'ai',
        text: 'Aapka match found!',
        bestMatch: {
          id: testProviderId,
          pricePerHour: 1000,
          negotiatedDateTime: undefined, // this undefined would throw in standard Firestore
          negotiatedStatus: undefined,   // this undefined would throw in standard Firestore
          negotiationTraces: undefined   // this undefined would throw in standard Firestore
        }
      }
    ];

    await saveChatSession(testSessionId, testUserId, "Test Clash Customer", testMessages, {
      category: "Plumber",
      providerName: undefined // nested undefined at metadata root
    });

    // Verify chat doc was written successfully
    const chatDoc = await getDoc(doc(db, 'chats', testSessionId));
    if (chatDoc.exists()) {
      const data = chatDoc.data();
      const aiMsg = data.messages[1];
      if (aiMsg.bestMatch.negotiatedDateTime === null) {
        console.log("✓ Deep sanitization successfully converted nested undefined values to null!");
      } else {
        throw new Error("FAIL: Deep sanitization failed to convert undefined values to null.");
      }
    } else {
      throw new Error("FAIL: saveChatSession document was not created.");
    }

    // Cleanup
    console.log("\nCleaning up test documents...");
    await deleteDoc(doc(db, 'users', testUserId));
    await deleteDoc(doc(db, 'users', testProviderUserId));
    await deleteDoc(doc(db, 'services', testProviderId));
    await deleteDoc(doc(db, 'bookings', booking1Id));
    await deleteDoc(doc(db, 'chats', testSessionId));
    console.log("Cleanup complete!");

    console.log("\n=================================================");
    console.log("🎉 SUCCESS: Booking slot clash & sanitization test passed!");
    console.log("=================================================");

  } catch (error: any) {
    console.error("\n❌ TEST FAILED:", error.message || error);
    process.exit(1);
  }
}
runTest();
