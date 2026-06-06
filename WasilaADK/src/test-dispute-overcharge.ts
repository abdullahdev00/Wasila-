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

    if (!decision.isValid || decision.action !== 'refund_difference' || decision.refundAmount !== 500) {
      throw new Error("Dispute Agent output is incorrect for Overcharge case!");
    }
    console.log("✓ Dispute Agent correctly resolved the Overcharge dispute.\n");

    // 5. Execute Resolution Actions (Deduct Provider, Refund Customer, Warning notification)
    console.log("Step 5: Executing overcharge resolution actions...");
    
    // A. Update booking payment status
    await updateDoc(doc(db, 'bookings', bookingId), {
      paymentStatus: 'refunded_partially',
      disputedAt: Date.now()
    });

    // B. Deduct overcharge from provider wallet
    const providerUserRef = doc(db, 'users', testProviderUserId);
    const providerUserSnap2 = await getDoc(providerUserRef);
    const pBalance = providerUserSnap2.data()?.walletBalance || 0;
    await setDoc(providerUserRef, {
      walletBalance: pBalance - decision.refundAmount
    }, { merge: true });

    // Log provider penalty transaction
    await logTransaction(
      testProviderUserId,
      "Test Overcharge Provider",
      'customer',
      "Test Overcharge Customer",
      bookingId,
      decision.refundAmount,
      'penalty',
      `Rs. ${decision.refundAmount} deducted due to overcharge dispute resolution`
    );

    // Create warning notification for provider
    await addDoc(collection(db, 'notifications'), {
      userId: testProviderUserId,
      title: "Overcharge Penalty Alert",
      message: `Customer ke dispute ki wajah se aap ke wallet se Rs. ${decision.refundAmount} deduct kar liye gaye hain.`,
      type: 'dispute_penalty',
      bookingId: bookingId,
      timestamp: new Date().toISOString(),
      read: false
    });

    // C. Deduct earnings from service doc
    const serviceRef = doc(db, 'services', testProviderId);
    const sSnap = await getDoc(serviceRef);
    const sEarnings = sSnap.data()?.earnings || 0;
    await updateDoc(serviceRef, {
      earnings: sEarnings - decision.refundAmount
    });

    // D. Refund customer wallet
    const customerUserRef = doc(db, 'users', testUserId);
    const customerUserSnap2 = await getDoc(customerUserRef);
    const cBalance = customerUserSnap2.data()?.walletBalance || 0;
    await setDoc(customerUserRef, {
      walletBalance: cBalance + decision.refundAmount
    }, { merge: true });

    // Log customer refund transaction
    await logTransaction(
      testUserId,
      "Test Overcharge Customer",
      testProviderId,
      "Test Overcharge Provider",
      bookingId,
      decision.refundAmount,
      'refund',
      `Rs. ${decision.refundAmount} refunded due to overcharge dispute resolution`
    );

    // E. Save dispute document
    await createDispute(
      bookingId,
      'overcharge',
      'agreed price Rs. 1500 thi, but unho ne extra cash le kar total Rs. 2000 charge kiya.',
      decision.action,
      decision.refundAmount,
      decision.verdictSummary
    );

    // 6. Verify final balances
    console.log("\nStep 6: Verifying final database balances...");
    const finalCustomerBalances = await getUserBalances(testUserId);
    const finalProviderUserSnap = await getDoc(doc(db, 'users', testProviderUserId));
    const finalProviderWallet = finalProviderUserSnap.data()?.walletBalance;
    const finalServiceSnap = await getDoc(doc(db, 'services', testProviderId));
    const finalServiceEarnings = finalServiceSnap.data()?.earnings;

    console.log(`Final Customer Wallet: Rs. ${finalCustomerBalances.walletBalance} (Expected: Rs. 4,000)`);
    console.log(`Final Provider Wallet: Rs. ${finalProviderWallet} (Expected: Rs. 1,000)`);
    console.log(`Final Provider Service Earnings: Rs. ${finalServiceEarnings} (Expected: Rs. 1,000)`);

    if (finalCustomerBalances.walletBalance !== 4000) {
      throw new Error("Final customer wallet balance verification failed!");
    }
    if (finalProviderWallet !== 1000) {
      throw new Error("Final provider wallet balance verification failed!");
    }
    if (finalServiceEarnings !== 1000) {
      throw new Error("Final provider service earnings verification failed!");
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
