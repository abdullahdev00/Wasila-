import { db, createBooking, getUserBalances } from './firebase';
import { DisputeAgent } from './agents/DisputeAgent';
import { doc, setDoc, getDoc, updateDoc, collection, addDoc } from 'firebase/firestore/lite';
import { releaseBookingPayment, logTransaction, createDispute } from './firebase';

async function runTest() {
  const testUserId = 'test-dispute-user-' + Date.now();
  const testProviderId = 'test-dispute-service-' + Date.now();
  const testProviderUserId = 'test-dispute-provider-user-' + Date.now();

  console.log("=== CHUNK 2: OVERCHARGE DISPUTE RESOLUTION TEST ===");
  console.log(`Test Customer User ID: ${testUserId}`);
  console.log(`Test Service ID: ${testProviderId}`);
  console.log(`Test Provider User ID: ${testProviderUserId}\n`);

  try {
    // 1. Setup initial user & service profile in Firestore
    console.log("Step 1: Setting initial customer balance to Rs. 5,000...");
    await setDoc(doc(db, 'users', testUserId), {
      name: "Test Overcharge Customer",
      walletBalance: 5000,
      holdingBalance: 0
    });

    console.log("Setting initial provider user wallet to Rs. 0 and service earnings to Rs. 0...");
    await setDoc(doc(db, 'users', testProviderUserId), {
      name: "Test Overcharge Provider User",
      walletBalance: 0,
      holdingBalance: 0
    });

    await setDoc(doc(db, 'services', testProviderId), {
      providerName: "Test Overcharge Provider",
      providerId: testProviderUserId,
      earnings: 0,
      price: 1500,
      reliabilityScore: 100,
      cancellations: 0,
      isActive: true
    });

    // 2. Create booking (Hold Rs. 1500)
    console.log("Step 2: Placing booking of Rs. 1,500 (Escrow hold)...");
    const bookingId = await createBooking(testUserId, testProviderId, { price: 1500, date: 'Tomorrow, 10:00 AM' });
    console.log(`Created booking ID: ${bookingId}`);

    let customerBalances = await getUserBalances(testUserId);
    console.log(`Customer Balances after Hold -> Wallet: Rs. ${customerBalances.walletBalance}, Holding: Rs. ${customerBalances.holdingBalance}`);
    if (customerBalances.walletBalance !== 3500 || customerBalances.holdingBalance !== 1500) {
      throw new Error("Initial escrow hold failed!");
    }

    // 3. Complete the booking (Release Rs. 1500 to provider)
    console.log("\nStep 3: Completing service and releasing payment of Rs. 1,500...");
    await releaseBookingPayment(testUserId, bookingId, 1500, testProviderId, "Test Overcharge Provider");

    // Force update booking status to completed (as in standard flow)
    await updateDoc(doc(db, 'bookings', bookingId), {
      status: 'completed'
    });

    customerBalances = await getUserBalances(testUserId);
    const providerUserSnap = await getDoc(doc(db, 'users', testProviderUserId));
    const providerWallet = providerUserSnap.data()?.walletBalance || 0;
    const serviceSnap = await getDoc(doc(db, 'services', testProviderId));
    const serviceEarnings = serviceSnap.data()?.earnings || 0;

    console.log(`Balances after Release:`);
    console.log(`- Customer Wallet: Rs. ${customerBalances.walletBalance}, Holding: Rs. ${customerBalances.holdingBalance}`);
    console.log(`- Provider Wallet: Rs. ${providerWallet}`);
    console.log(`- Provider Service Earnings: Rs. ${serviceEarnings}`);

    if (customerBalances.walletBalance !== 3500 || customerBalances.holdingBalance !== 0 || providerWallet !== 1500 || serviceEarnings !== 1500) {
      throw new Error("Escrow payment release failed!");
    }

    // 4. Instantiate DisputeAgent and evaluate Overcharge
    console.log("\nStep 4: Evaluating dispute with DisputeAgent (Type: 'overcharge')...");
    const disputeAgent = new DisputeAgent();
    
    // Fetch current booking data
    const bookingSnap = await getDoc(doc(db, 'bookings', bookingId));
    const bookingData = bookingSnap.data();

    const decision = await disputeAgent.evaluateDispute('overcharge', 'agreed price Rs. 1500 thi, but unho ne extra cash le kar total Rs. 2000 charge kiya.', {
      id: bookingId,
      ...bookingData
    });

    console.log("Dispute Agent Output:");
    console.log(JSON.stringify(decision, null, 2));

    if (decision.isValid || decision.action !== 'rejected' || decision.refundAmount !== 0) {
      throw new Error("Dispute Agent output is incorrect for Overcharge check case!");
    }
    console.log("✓ Dispute Agent correctly rejected the Overcharge dispute.\n");

    // 5. Save dispute document as rejected
    console.log("Step 5: Saving rejected dispute record...");
    await createDispute(
      bookingId,
      'overcharge',
      'agreed price Rs. 1500 thi, but unho ne extra cash le kar total Rs. 2000 charge kiya.',
      'rejected',
      0,
      decision.verdictSummary,
      'rejected'
    );

    // 6. Verify final balances (Must remain unchanged since dispute was rejected)
    console.log("\nStep 6: Verifying final database balances remain unchanged...");
    const finalCustomerBalances = await getUserBalances(testUserId);
    const finalProviderUserSnap = await getDoc(doc(db, 'users', testProviderUserId));
    const finalProviderWallet = finalProviderUserSnap.data()?.walletBalance;
    const finalServiceSnap = await getDoc(doc(db, 'services', testProviderId));
    const finalServiceEarnings = finalServiceSnap.data()?.earnings;

    console.log(`Final Customer Wallet: Rs. ${finalCustomerBalances.walletBalance} (Expected: Rs. 3,500)`);
    console.log(`Final Provider Wallet: Rs. ${finalProviderWallet} (Expected: Rs. 1,500)`);
    console.log(`Final Provider Service Earnings: Rs. ${finalServiceEarnings} (Expected: Rs. 1,500)`);

    if (finalCustomerBalances.walletBalance !== 3500) {
      throw new Error("Final customer wallet balance verification failed (should remain Rs. 3,500)!");
    }
    if (finalProviderWallet !== 1500) {
      throw new Error("Final provider wallet balance verification failed (should remain Rs. 1,500)!");
    }
    if (finalServiceEarnings !== 1500) {
      throw new Error("Final provider service earnings verification failed (should remain Rs. 1,500)!");
    }

    console.log("\n=================================================");
    console.log("🎉 SUCCESS: Chunk 2 (Overcharge Dispute) test passed!");
    console.log("=================================================");

  } catch (err: any) {
    console.error("\n❌ TEST FAILED:", err.message || err);
    process.exit(1);
  }
}

runTest();
