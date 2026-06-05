import { collection, addDoc, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore/lite';
import axios from 'axios';
import dotenv from 'dotenv';
import { db } from './src/firebase';

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
  console.log("=== Integration Test: Provider Reliability & Re-Ranking ===");

  const PORT = process.env.PORT || 5000;
  const BASE_URL = `http://localhost:${PORT}/api`;

  // 1. Create two test providers in Firestore services collection
  console.log("\n[Test Setup] Creating two test plumbers in Firestore...");
  
  // Plumber A: Will become unreliable
  const plumberADoc = await addDoc(collection(db, 'services'), {
    name: "Unreliable Plumber Service",
    providerName: "Zahid Plumber",
    category: "Plumber_Test_Unique",
    rating: 4.8,
    price: 800, // Cheaper to ensure competitiveness
    address: "Islamabad",
    isActive: true,
    reliabilityScore: 100,
    lateArrivals: 0,
    cancellations: 0,
    totalCompletedBookings: 0
  });

  // Plumber B: Will stay highly reliable
  const plumberBDoc = await addDoc(collection(db, 'services'), {
    name: "Reliable Plumber Service",
    providerName: "Yasir Plumber",
    category: "Plumber_Test_Unique",
    rating: 4.9, // Higher rating to guarantee selection
    price: 800, // Cheaper to ensure competitiveness
    address: "Islamabad",
    isActive: true,
    reliabilityScore: 100,
    lateArrivals: 0,
    cancellations: 0,
    totalCompletedBookings: 0
  });

  console.log(`- Created Plumber A (Zahid, Rating 4.8, Reliability 100%) with ID: ${plumberADoc.id}`);
  console.log(`- Created Plumber B (Yasir, Rating 4.9, Reliability 100%) with ID: ${plumberBDoc.id}`);

  try {
    // 2. Create a booking for Plumber A (scheduled time was 30 mins ago to guarantee it's late)
    console.log("\n[Test 1] Creating a booking for Plumber A scheduled in the past...");
    const scheduledTime = Date.now() - 30 * 60 * 1000; // 30 mins ago
    
    const bookingCol = collection(db, 'bookings');
    const bookingDoc = await addDoc(bookingCol, {
      userId: 'test-user-reliability',
      userName: 'Test User',
      serviceId: plumberADoc.id,
      serviceName: 'Unreliable Plumber Service',
      category: 'Plumber_Test_Unique',
      price: 1200,
      providerId: 'zahid_provider_id',
      providerName: 'Zahid Plumber',
      status: 'pending',
      date: '30 mins ago',
      scheduledTimestamp: scheduledTime,
      timestamp: new Date().toISOString()
    });

    console.log(`- Created Booking ID: ${bookingDoc.id}`);

    // 3. Trigger Arrival late
    console.log("\n[Test 2] Simulating provider arrival (should flag as LATE)...");
    const arrivedRes = await axios.post(`${BASE_URL}/bookings/${bookingDoc.id}/arrived`);
    console.log("Response:", arrivedRes.data);

    // Verify database updates for Plumber A
    let serviceSnap = await retryGetDoc(doc(db, 'services', plumberADoc.id));
    let serviceData = serviceSnap.data();
    console.log(`- Plumber A new metrics: lateArrivals = ${serviceData?.lateArrivals}, reliabilityScore = ${serviceData?.reliabilityScore}%`);

    if (serviceData?.reliabilityScore !== 95) {
      throw new Error(`Expected reliability score to be 95, but got: ${serviceData?.reliabilityScore}`);
    }
    console.log("✔ Late arrival penalty applied successfully!");

    // 4. Create another booking for Plumber A and simulate cancellation
    console.log("\n[Test 3] Creating another booking for Plumber A to cancel...");
    const bookingDoc2 = await addDoc(bookingCol, {
      userId: 'test-user-reliability',
      userName: 'Test User',
      serviceId: plumberADoc.id,
      serviceName: 'Unreliable Plumber Service',
      category: 'Plumber_Test_Unique',
      price: 1200,
      providerId: 'zahid_provider_id',
      providerName: 'Zahid Plumber',
      status: 'pending',
      date: 'Tomorrow, 10:00 AM',
      scheduledTimestamp: Date.now() + 24 * 60 * 60 * 1000,
      timestamp: new Date().toISOString()
    });

    console.log(`- Created second Booking ID: ${bookingDoc2.id}`);

    console.log("\n[Test 4] Simulating provider cancellation...");
    const cancelRes = await axios.post(`${BASE_URL}/bookings/${bookingDoc2.id}/provider-cancel`);
    console.log("Response:", cancelRes.data);

    // Verify Plumber A is penalized in rating and reliability
    serviceSnap = await retryGetDoc(doc(db, 'services', plumberADoc.id));
    serviceData = serviceSnap.data();
    console.log(`- Plumber A new metrics: cancellations = ${serviceData?.cancellations}, reliabilityScore = ${serviceData?.reliabilityScore}%, rating = ${serviceData?.rating}`);

    if (serviceData?.reliabilityScore !== 85) {
      throw new Error(`Expected reliability score to be 85, but got: ${serviceData?.reliabilityScore}`);
    }
    if (serviceData?.rating !== 4.6) {
      throw new Error(`Expected rating to drop to 4.6 (4.8 - 0.2), but got: ${serviceData?.rating}`);
    }
    console.log("✔ Provider cancellation penalties applied successfully!");

    // 5. Test Matchmaker Re-ranking
    console.log("\n[Test 5] Querying Matchmaker Agent to check re-ranking...");
    console.log("Context: Plumber A has rating 4.6, reliability 85%. Plumber B has rating 4.6, reliability 100%.");
    console.log("The Matchmaker should rank Plumber B (Yasir) higher due to 100% reliability.");

    const { MatchmakerAgent } = await import('./src/agents/MatchmakerAgent');
    const matchmaker = new MatchmakerAgent();
    const matchResult = await matchmaker.findMatch("Mujhe Plumber_Test_Unique chahiye Islamabad me", "Plumber_Test_Unique", "Islamabad");
    console.log("\nMatchmaker Best Match Result:");
    console.log(JSON.stringify(matchResult.bestMatch, null, 2));
    console.log("Matchmaker Reasoning:", matchResult.reasoning);

    if (matchResult.bestMatch.id === plumberADoc.id) {
      throw new Error(`Expected Matchmaker to deprioritize Plumber A (Zahid Plumber, ID: ${plumberADoc.id}) due to lower reliability (85%), but it was selected!`);
    }

    if (matchResult.bestMatch.id !== plumberBDoc.id) {
      throw new Error(`Expected Matchmaker to select Plumber B (Yasir Plumber, ID: ${plumberBDoc.id}) due to high rating & reliability, but it selected ID: ${matchResult.bestMatch.id}`);
    }
    console.log("\n✔ Matchmaker correctly prioritized the reliable test provider and deprioritized the unreliable one!");
    console.log("✔ Integration test for Provider Reliability & Re-Ranking passed successfully!");

  } finally {
    // Cleanup Firestore documents
    console.log("\n[Cleanup] Removing temporary test documents from Firestore...");
    try {
      await retryDeleteDoc(doc(db, 'services', plumberADoc.id));
      await retryDeleteDoc(doc(db, 'services', plumberBDoc.id));
      console.log("- Temporary Plumber A and B service documents deleted.");
    } catch (cleanupErr: any) {
      console.warn("Cleanup warning: Failed to delete some service docs:", cleanupErr.message);
    }
  }
}

runTest().catch(err => {
  console.error("\nFAIL: Test failed with error:", err);
  process.exit(1);
});
