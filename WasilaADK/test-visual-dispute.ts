import { collection, addDoc, doc, getDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore/lite';
import axios from 'axios';
import dotenv from 'dotenv';
import { db } from './src/firebase';
import { MatchmakerAgent } from './src/agents/MatchmakerAgent';

dotenv.config();

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

async function runTest() {
  console.log("==========================================================================");
  console.log("🚀 INTEGRATION TEST: VISUAL DISPUTE RESOLUTION & BLACKLIST SYSTEM");
  console.log("==========================================================================\n");

  const PORT = process.env.PORT || 5000;
  const BASE_URL = `http://localhost:${PORT}/api`;

  const testUserId = `test-user-visual-${Date.now()}`;
  const testProviderUserId = `test-provider-user-${Date.now()}`;
  const testServiceId = `test-service-${Date.now()}`;

  // 1. Create a test customer in Firestore `/users`
  console.log("[Test Setup] Creating test customer in Firestore...");
  const customerRef = doc(db, 'users', testUserId);
  await setDoc(customerRef, {
    name: "Visual Dispute Customer",
    address: "Islamabad",
    blacklistedProviders: []
  });

  // 2. Create a test provider in Firestore `/services`
  console.log("[Test Setup] Creating test service provider in Firestore...");
  const serviceRef = doc(db, 'services', testServiceId);
  await setDoc(serviceRef, {
    name: "Visual Quality Test Service",
    providerName: "Quality Provider",
    category: "Electrician",
    rating: 4.8,
    pricePerHour: 1000,
    address: "Islamabad",
    isActive: true,
    reliabilityScore: 100
  });

  // Also create user record for provider (so notifications can be mapped)
  const providerUserRef = doc(db, 'users', testProviderUserId);
  await setDoc(providerUserRef, {
    name: "Quality Provider",
    walletBalance: 0
  });

  console.log(`- Customer ID: ${testUserId}`);
  console.log(`- Service ID: ${testServiceId}`);
  console.log(`- Provider User ID: ${testProviderUserId}`);

  let bookingId = '';

  try {
    // 3. Create a completed booking that has quality issues
    console.log("\n[Test 1] Creating a booking in Firestore...");
    const bookingCol = collection(db, 'bookings');
    const bookingDoc = await addDoc(bookingCol, {
      userId: testUserId,
      userName: "Visual Dispute Customer",
      serviceId: testServiceId,
      serviceName: "Visual Quality Test Service",
      category: "Electrician",
      price: 1500,
      providerId: testProviderUserId,
      providerName: "Quality Provider",
      status: "completed",
      date: "Today, 12:00 PM",
      timestamp: new Date().toISOString()
    });
    bookingId = bookingDoc.id;
    console.log(`- Created Booking ID: ${bookingId}`);

    // 4. File a poor quality dispute with before and after images
    console.log("\n[Test 2] Filing a poor quality dispute with Before and After images...");
    const beforeImage = "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400";
    const afterImage = "https://images.unsplash.com/photo-1621905252507-b354bc25edac?w=400";

    const disputeRes = await axios.post(`${BASE_URL}/disputes`, {
      bookingId,
      issueType: "poor_quality",
      details: "Electrician ne wires theek se andar nahi kiye aur saare open board chhor diye hain jo dangerous hain.",
      beforeImage,
      afterImage
    });

    console.log("Dispute Response:", JSON.stringify(disputeRes.data, null, 2));

    // Verify response
    if (!disputeRes.data.success || !disputeRes.data.isValid || !disputeRes.data.pendingProviderResponse) {
      throw new Error("Dispute submission or multimodal evaluation failed.");
    }
    console.log("✔ Dispute successfully evaluated by DisputeAgent. Status pending provider response.");

    // Check database to verify updates
    const bookingSnap = await retryGetDoc(doc(db, 'bookings', bookingId));
    console.log(`- Booking status: ${bookingSnap.data()?.status}`);
    if (bookingSnap.data()?.status !== 'disputed_poor_quality') {
      throw new Error(`Expected booking status to be 'disputed_poor_quality', but got: ${bookingSnap.data()?.status}`);
    }
    console.log("✔ Booking status successfully set to disputed_poor_quality!");

    // 5. Simulate Provider Response: "rectify"
    console.log("\n[Test 3] Simulating Provider response: 'rectify' ('Arha hoon')...");
    const responseRes1 = await axios.post(`${BASE_URL}/bookings/${bookingId}/poor-quality-response`, {
      response: "rectify"
    });
    console.log("Provider Response Endpoint:", responseRes1.data);

    // Verify status in DB
    const bookingSnap2 = await retryGetDoc(doc(db, 'bookings', bookingId));
    console.log(`- Booking status: ${bookingSnap2.data()?.status}`);
    if (bookingSnap2.data()?.status !== 'provider_rectifying') {
      throw new Error(`Expected booking status to be 'provider_rectifying', but got: ${bookingSnap2.data()?.status}`);
    }
    console.log("✔ Booking status successfully updated to provider_rectifying!");

    // 6. Simulate Provider Response: "explain"
    console.log("\n[Test 4] Simulating Provider response: 'explain' with text...");
    const responseRes2 = await axios.post(`${BASE_URL}/bookings/${bookingId}/poor-quality-response`, {
      response: "explain",
      explanation: "Masla yeh tha k unit purana tha aur client ne wiring replace nahi krwayi, wiring theek hai."
    });
    console.log("Provider Response Endpoint:", responseRes2.data);

    // Verify status in DB
    const bookingSnap3 = await retryGetDoc(doc(db, 'bookings', bookingId));
    console.log(`- Booking status: ${bookingSnap3.data()?.status}`);
    if (bookingSnap3.data()?.status !== 'provider_explained') {
      throw new Error(`Expected booking status to be 'provider_explained', but got: ${bookingSnap3.data()?.status}`);
    }
    console.log("✔ Booking status successfully updated to provider_explained!");

    // 7. Customer is dissatisfied: "unsatisfied" -> Deduct -10 points & blacklist
    console.log("\n[Test 5] Simulating Customer choice: 'unsatisfied'...");
    const resolveRes = await axios.post(`${BASE_URL}/bookings/${bookingId}/poor-quality-resolve`, {
      action: "unsatisfied"
    });
    console.log("Customer Resolve Endpoint:", resolveRes.data);

    // Verify booking final status
    const bookingSnap4 = await retryGetDoc(doc(db, 'bookings', bookingId));
    console.log(`- Booking status: ${bookingSnap4.data()?.status}`);
    if (bookingSnap4.data()?.status !== 'cancelled_by_dispute') {
      throw new Error(`Expected booking status to be 'cancelled_by_dispute', but got: ${bookingSnap4.data()?.status}`);
    }

    // Verify provider's reliability score drops by 10 points
    const serviceSnap = await retryGetDoc(serviceRef);
    console.log(`- Provider reliability score: ${serviceSnap.data()?.reliabilityScore}%`);
    if (serviceSnap.data()?.reliabilityScore !== 90) {
      throw new Error(`Expected provider reliability score to drop to 90%, but got: ${serviceSnap.data()?.reliabilityScore}%`);
    }
    console.log("✔ Provider reliability score successfully deducted by 10 points!");

    // Verify customer's blacklist contains the provider userId
    const customerSnap = await retryGetDoc(customerRef);
    const blacklist = customerSnap.data()?.blacklistedProviders || [];
    console.log(`- Customer blacklist:`, blacklist);
    if (!blacklist.includes(testProviderUserId)) {
      throw new Error(`Expected customer's blacklistedProviders list to contain provider ${testProviderUserId}`);
    }
    console.log("✔ Provider successfully added to customer's blacklist!");

    // 8. Test Matchmaker agent filters out blacklisted providers
    console.log("\n[Test 6] Verifying Matchmaker Agent filters out the blacklisted provider...");
    const matchmaker = new MatchmakerAgent();
    // Search as the customer
    const matchResult = await matchmaker.findMatch(
      "Mujhe AC repair wala chahye Islamabad me",
      "AC Repair",
      "Islamabad",
      undefined,
      null,
      blacklist
    );
    
    console.log("Matchmaker Best Match Result:", JSON.stringify(matchResult.bestMatch, null, 2));
    console.log("Matchmaker Reasoning:", matchResult.reasoning);

    if (matchResult.bestMatch && matchResult.bestMatch.id === testServiceId) {
      throw new Error("Matchmaker matched the blacklisted provider! Blacklist filtering failed.");
    }
    console.log("✔ Matchmaker successfully filtered out the blacklisted provider!");
    console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY!");

  } finally {
    // 9. Cleanup database
    console.log("\n[Cleanup] Cleaning up test records from Firestore...");
    if (bookingId) {
      try {
        await retryDeleteDoc(doc(db, 'bookings', bookingId));
      } catch (e) {}
    }
    try {
      await retryDeleteDoc(customerRef);
    } catch (e) {}
    try {
      await retryDeleteDoc(serviceRef);
    } catch (e) {}
    try {
      await retryDeleteDoc(providerUserRef);
    } catch (e) {}
    console.log("✔ Cleanup completed.");
  }
}

runTest().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
