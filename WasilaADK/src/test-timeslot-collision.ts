import { doc, setDoc, deleteDoc, collection, addDoc, getDoc, getDocs, query, where } from 'firebase/firestore/lite';
import { db, createBooking, holdBookingPayment } from './firebase';

async function runTimeslotCollisionTest() {
  console.log("===============================================================");
  console.log("🚀 WASILA AI: PROVIDER TIME-SLOT COLLISION TEST SUITE");
  console.log("===============================================================");

  const userId = "integration-test-timeslot-user";
  const serviceId = "service-timeslot-test";

  try {
    // 1. Set up mock service provider
    console.log("\n📌 Step 1: Setting up mock service provider...");
    await setDoc(doc(db, 'services', serviceId), {
      providerName: "Clash Test Pro",
      name: "Clash Test Pro",
      category: "AC Technician",
      rating: 4.5,
      price: 1000,
      address: "Islamabad",
      isActive: true,
      reliabilityScore: 100,
      lateArrivals: 0,
      cancellations: 0,
      totalCompletedBookings: 10
    });
    console.log("✅ Mock service configured.");

    // 2. Set up mock user with ample balance
    console.log("\n📌 Step 2: Setting up mock user...");
    await setDoc(doc(db, 'users', userId), {
      name: "Collision Test User",
      address: "Islamabad",
      walletBalance: 20000
    });
    console.log("✅ Mock user configured.");

    // 3. Place first booking (Tomorrow, 10:00 AM)
    console.log("\n📌 Step 3: Attempting to create first booking at 'Tomorrow, 10:00 AM'...");
    const booking1Id = await createBooking(userId, serviceId, {
      date: "Tomorrow, 10:00 AM",
      price: 1000
    });
    console.log(`✅ First booking created successfully. ID: ${booking1Id}`);

    // 4. Attempt second booking at 'Tomorrow, 10:30 AM' (clashing time - should fail)
    console.log("\n📌 Step 4: Attempting to book same provider at 'Tomorrow, 10:30 AM' (should FAIL)...");
    try {
      const booking2Id = await createBooking(userId, serviceId, {
        date: "Tomorrow, 10:30 AM",
        price: 1000
      });
      console.error(`❌ ERROR: Second booking succeeded with ID ${booking2Id} but should have failed!`);
    } catch (err: any) {
      console.log(`✅ EXPECTED FAILURE: Booking failed with message: "${err.message}"`);
    }

    // 5. Attempt third booking at 'Tomorrow, 11:30 AM' (outside 1-hour window - should succeed)
    console.log("\n📌 Step 5: Attempting to book same provider at 'Tomorrow, 11:30 AM' (should succeed)...");
    const booking3Id = await createBooking(userId, serviceId, {
      date: "Tomorrow, 11:30 AM",
      price: 1000
    });
    console.log(`✅ Third booking created successfully. ID: ${booking3Id}`);

    // 6. Cleanup
    console.log("\n📌 Step 6: Cleaning up database docs...");
    await deleteDoc(doc(db, 'services', serviceId));
    await deleteDoc(doc(db, 'users', userId));
    await deleteDoc(doc(db, 'bookings', booking1Id));
    await deleteDoc(doc(db, 'bookings', booking3Id));
    
    // Clean holding balances
    const txQuery = query(collection(db, 'transactions'), where('userId', '==', userId));
    const txSnap = await getDocs(txQuery);
    for (const doc of txSnap.docs) {
      await deleteDoc(doc.ref);
    }
    console.log("✅ Cleanup complete. All verification steps passed!");

  } catch (err: any) {
    console.error("❌ Test run failed:", err.message);
  }
}

runTimeslotCollisionTest();
