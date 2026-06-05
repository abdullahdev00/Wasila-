import { db, createBooking, holdBookingPayment, releaseBookingPayment, refundBookingPayment, getUserBalances } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore/lite';

async function runTest() {
  const testUserId = 'test-wallet-user-' + Date.now();
  const testProviderId = 'test-service-' + Date.now();

  console.log("=== WALLET & HOLDING (ESCROW) SYSTEM TEST ===");
  console.log(`Test Customer User ID: ${testUserId}`);
  console.log(`Test Service ID: ${testProviderId}\n`);

  try {
    // 1. Setup initial user & service profile in Firestore
    console.log("Step 1: Setting initial customer balance to Rs. 5,000...");
    await setDoc(doc(db, 'users', testUserId), {
      name: "Test Escrow Customer",
      walletBalance: 5000,
      holdingBalance: 0
    });

    console.log("Setting initial provider earnings to Rs. 0...");
    await setDoc(doc(db, 'services', testProviderId), {
      providerName: "Test Escrow Provider",
      providerId: 'test-provider-user-' + Date.now(),
      earnings: 0,
      price: 1500,
      isActive: true
    });

    // Verify initial state
    let balances = await getUserBalances(testUserId);
    console.log(`Initial balances -> Wallet: Rs. ${balances.walletBalance}, Holding: Rs. ${balances.holdingBalance}`);
    if (balances.walletBalance !== 5000 || balances.holdingBalance !== 0) {
      throw new Error("Initial setup balance verification failed!");
    }
    console.log("✓ Initial state matches expectations.\n");

    // 2. Simulate Booking Placement (Hold Payment)
    console.log("Step 2: Creating a booking of Rs. 1,500 (this should automatically place funds on hold)...");
    const bookingId = await createBooking(testUserId, testProviderId, { price: 1500 });
    console.log(`Created booking ID: ${bookingId}`);

    balances = await getUserBalances(testUserId);
    console.log(`Balances after Hold -> Wallet: Rs. ${balances.walletBalance}, Holding: Rs. ${balances.holdingBalance}`);
    if (balances.walletBalance !== 3500 || balances.holdingBalance !== 1500) {
      throw new Error("Escrow hold balance verification failed!");
    }
    console.log("✓ Escrow hold state matches expectations.\n");

    // 3. Simulate Job Completion (Release Payment to Provider)
    console.log("Step 3: Completing job and releasing Rs. 1,500 hold to provider...");
    await releaseBookingPayment(testUserId, bookingId, 1500, testProviderId, "Test Escrow Provider");

    balances = await getUserBalances(testUserId);
    console.log(`Balances after Release -> Wallet: Rs. ${balances.walletBalance}, Holding: Rs. ${balances.holdingBalance}`);
    
    const serviceSnap = await getDoc(doc(db, 'services', testProviderId));
    const providerEarnings = serviceSnap.exists() ? (serviceSnap.data().earnings || 0) : 0;
    console.log(`Provider Earnings after Release: Rs. ${providerEarnings}`);

    if (balances.walletBalance !== 3500 || balances.holdingBalance !== 0 || providerEarnings !== 1500) {
      throw new Error("Escrow release balance verification failed!");
    }
    console.log("✓ Escrow release state matches expectations.\n");

    // 4. Simulate Cancellation (Refund Payment to Customer)
    console.log("Step 4: Creating a second booking of Rs. 1,000 for cancel/refund test...");
    const secondBookingId = await createBooking(testUserId, testProviderId, { price: 1000 });
    console.log(`Created second booking ID: ${secondBookingId}`);

    balances = await getUserBalances(testUserId);
    console.log(`Balances before Cancel -> Wallet: Rs. ${balances.walletBalance}, Holding: Rs. ${balances.holdingBalance}`);
    if (balances.walletBalance !== 2500 || balances.holdingBalance !== 1000) {
      throw new Error("Second hold balance verification failed!");
    }
    
    console.log("Triggering provider cancel/refund for Rs. 1,000 hold...");
    await refundBookingPayment(testUserId, secondBookingId, 1000, testProviderId, "Test Escrow Provider");

    balances = await getUserBalances(testUserId);
    console.log(`Balances after Refund -> Wallet: Rs. ${balances.walletBalance}, Holding: Rs. ${balances.holdingBalance}`);
    
    if (balances.walletBalance !== 3500 || balances.holdingBalance !== 0) {
      throw new Error("Escrow refund balance verification failed!");
    }
    console.log("✓ Escrow refund state matches expectations.\n");

    console.log("=================================================");
    console.log("🎉 SUCCESS: All Escrow/Holding wallet tests passed!");
    console.log("=================================================");

  } catch (err: any) {
    console.error("\n❌ TEST FAILED:", err.message || err);
    process.exit(1);
  }
}

runTest();
