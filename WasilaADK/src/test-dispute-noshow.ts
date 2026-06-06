import { db, createBooking, getUserBalances } from './firebase';
import { DisputeAgent } from './agents/DisputeAgent';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore/lite';
import { refundBookingPayment, createDispute } from './firebase';

async function runTest() {
  const testUserId = 'test-dispute-user-' + Date.now();
  const testProviderId = 'test-dispute-service-' + Date.now();
  const testProviderUserId = 'test-dispute-provider-user-' + Date.now();

  console.log("=== CHUNK 1: NO-SHOW DISPUTE RESOLUTION TEST ===");
  console.log(`Test Customer User ID: ${testUserId}`);
  console.log(`Test Service ID: ${testProviderId}`);
  console.log(`Test Provider User ID: ${testProviderUserId}\n`);

  try {
    // 1. Setup initial user & service profile in Firestore
    console.log("Step 1: Setting initial customer balance to Rs. 5,000...");
    await setDoc(doc(db, 'users', testUserId), {
      name: "Test Dispute Customer",
      walletBalance: 5000,
      holdingBalance: 0
    });

    console.log("Setting initial provider reliability to 100%...");
    await setDoc(doc(db, 'services', testProviderId), {
      providerName: "Test Dispute Provider",
      providerId: testProviderUserId,
      earnings: 0,
      price: 1500,
      reliabilityScore: 100,
      cancellations: 0,
      isActive: true
    });

    // 2. Create booking (Hold Rs. 1500)
    console.log("Step 2: Placing booking of Rs. 1,500 (Funds automatically put on hold)...");
    const bookingId = await createBooking(testUserId, testProviderId, { price: 1500, date: 'Tomorrow, 10:00 AM' });
    console.log(`Created booking ID: ${bookingId}`);

    let balances = await getUserBalances(testUserId);
    console.log(`Balances after Hold -> Wallet: Rs. ${balances.walletBalance}, Holding: Rs. ${balances.holdingBalance}`);
    if (balances.walletBalance !== 3500 || balances.holdingBalance !== 1500) {
      throw new Error("Initial escrow hold failed!");
    }

    // 3. Instantiate DisputeAgent and evaluate No-Show
    console.log("\nStep 3: Evaluating dispute with DisputeAgent (Type: 'no_show')...");
    const disputeAgent = new DisputeAgent();
    
    // Fetch booking to pass as input
    const bookingSnap = await getDoc(doc(db, 'bookings', bookingId));
    const bookingData = bookingSnap.data();

    const decision = await disputeAgent.evaluateDispute('no_show', 'Provider never arrived at my house.', {
      id: bookingId,
      ...bookingData
    });

    console.log("Dispute Agent Output:");
    console.log(JSON.stringify(decision, null, 2));

    if (!decision.isValid || decision.action !== 'refund_full' || decision.refundAmount !== 1500) {
      throw new Error("Dispute Agent output is incorrect for No-Show case!");
    }
    console.log("✓ Dispute Agent correctly resolved the No-Show dispute.\n");

    // 4. Execute Resolution Actions (Cancel Booking, Refund Customer, Penalize Provider)
    console.log("Step 4: Executing resolution actions...");
    
    // A. Update booking status
    await updateDoc(doc(db, 'bookings', bookingId), {
      status: 'cancelled_by_dispute',
      disputedAt: Date.now()
    });

    // B. Refund Customer
    await refundBookingPayment(testUserId, bookingId, 1500, testProviderId, "Test Dispute Provider");

    // C. Penalize Provider
    const serviceRef = doc(db, 'services', testProviderId);
    const serviceSnap = await getDoc(serviceRef);
    const serviceData = serviceSnap.data();
    const cancellations = (serviceData?.cancellations || 0) + 1;
    const newScore = Math.max(0, (serviceData?.reliabilityScore || 100) - decision.providerPenalty);

    await updateDoc(serviceRef, {
      cancellations,
      reliabilityScore: newScore
    });

    // D. Log Dispute Document
    await createDispute(
      bookingId,
      'no_show',
      'Provider never arrived at my house.',
      decision.action,
      decision.refundAmount,
      decision.verdictSummary
    );

    // 5. Verify final balance and reliability states
    console.log("\nStep 5: Verifying final database states...");
    balances = await getUserBalances(testUserId);
    console.log(`Final Customer Balances -> Wallet: Rs. ${balances.walletBalance}, Holding: Rs. ${balances.holdingBalance}`);
    
    const finalServiceSnap = await getDoc(serviceRef);
    const finalServiceData = finalServiceSnap.data();
    console.log(`Final Provider Reliability: ${finalServiceData?.reliabilityScore}% (Cancellations: ${finalServiceData?.cancellations})`);

    const bookingFinalSnap = await getDoc(doc(db, 'bookings', bookingId));
    const finalBookingStatus = bookingFinalSnap.data()?.status;
    console.log(`Final Booking Status: ${finalBookingStatus}`);

    if (balances.walletBalance !== 5000 || balances.holdingBalance !== 0) {
      throw new Error("Escrow refund verification failed!");
    }
    if (finalServiceData?.reliabilityScore !== 85 || finalServiceData?.cancellations !== 1) {
      throw new Error("Provider penalty verification failed!");
    }
    if (finalBookingStatus !== 'cancelled_by_dispute') {
      throw new Error("Booking status update failed!");
    }

    console.log("\n=================================================");
    console.log("🎉 SUCCESS: Chunk 1 (No-Show Dispute) test passed!");
    console.log("=================================================");

  } catch (err: any) {
    console.error("\n❌ TEST FAILED:", err.message || err);
    process.exit(1);
  }
}

runTest();
