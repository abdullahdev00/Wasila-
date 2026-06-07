import { doc, setDoc, deleteDoc, collection, addDoc, getDoc, getDocs, query, where } from 'firebase/firestore/lite';
import { db } from './firebase';
import { MemoryAgent } from './agents/MemoryAgent';

async function runCustomerMemoryTest() {
  console.log("===============================================================");
  console.log("🚀 WASILA AI: CUSTOMER LONG-TERM MEMORY INTEGRATION TEST SUITE");
  console.log("===============================================================");

  const budgetUserId = "integration-test-budget";
  const premiumUserId = "integration-test-premium";

  const cheapServiceId = "service-cheap-ac-test";
  const premiumServiceId = "service-premium-ac-test";

  const memoryAgent = new MemoryAgent();

  try {
    // 1. Set up mock services/providers in Firestore
    console.log("\n📌 Step 1: Setting up mock service providers in Firestore...");
    
    await setDoc(doc(db, 'services', cheapServiceId), {
      providerName: "Cheap AC Repair Pro",
      name: "Cheap AC Repair Pro",
      category: "AC Technician",
      rating: 4.1,
      price: 800,
      address: "Islamabad",
      isActive: true,
      reliabilityScore: 100,
      lateArrivals: 0,
      cancellations: 0,
      totalCompletedBookings: 15
    });

    await setDoc(doc(db, 'services', premiumServiceId), {
      providerName: "Premium AC Repair Pro",
      name: "Premium AC Repair Pro",
      category: "AC Technician",
      rating: 4.9,
      price: 2200,
      address: "Islamabad",
      isActive: true,
      reliabilityScore: 100,
      lateArrivals: 0,
      cancellations: 0,
      totalCompletedBookings: 50
    });

    console.log("✅ Mock services configured.");

    // 2. Set up mock users
    console.log("\n📌 Step 2: Setting up mock users...");
    await setDoc(doc(db, 'users', budgetUserId), {
      name: "Budget Customer",
      address: "Islamabad",
      walletBalance: 5000
    });

    await setDoc(doc(db, 'users', premiumUserId), {
      name: "Premium Customer",
      address: "Islamabad",
      walletBalance: 10000
    });
    console.log("✅ Mock users configured.");

    // 3. Create completed booking & transaction history
    console.log("\n📌 Step 3: Generating historical bookings & transactions...");
    
    // Budget Customer History (Low-value completed booking)
    const bookingBudgetRef = await addDoc(collection(db, 'bookings'), {
      userId: budgetUserId,
      serviceId: cheapServiceId,
      providerName: "Cheap AC Repair Pro",
      category: "AC Technician",
      price: 800,
      status: "completed",
      date: "2026-06-01",
      scheduledTimestamp: Date.now() - 500000
    });

    await addDoc(collection(db, 'transactions'), {
      userId: budgetUserId,
      bookingId: bookingBudgetRef.id,
      amount: 800,
      type: "debit",
      description: "Payment for AC Repair Test"
    });

    // Premium Customer History (High-value completed booking)
    const bookingPremiumRef = await addDoc(collection(db, 'bookings'), {
      userId: premiumUserId,
      serviceId: premiumServiceId,
      providerName: "Premium AC Repair Pro",
      category: "AC Technician",
      price: 2200,
      status: "completed",
      date: "2026-06-02",
      scheduledTimestamp: Date.now() - 300000
    });

    await addDoc(collection(db, 'transactions'), {
      userId: premiumUserId,
      bookingId: bookingPremiumRef.id,
      amount: 2200,
      type: "debit",
      description: "Payment for AC Repair Test"
    });

    console.log("✅ History generated.");

    // 4. Trigger preference learning for both users using MemoryAgent
    console.log("\n📌 Step 4: Running MemoryAgent preference learning...");
    
    console.log("Analyzing Budget Customer...");
    const budgetPref = await memoryAgent.learnFinancialPreferences(budgetUserId);
    console.log("Budget Pref learned:", budgetPref);

    console.log("Analyzing Premium Customer...");
    const premiumPref = await memoryAgent.learnFinancialPreferences(premiumUserId);
    console.log("Premium Pref learned:", premiumPref);

    // Verify written values in Firestore
    const budgetUserSnap = await getDoc(doc(db, 'users', budgetUserId));
    const premiumUserSnap = await getDoc(doc(db, 'users', premiumUserId));

    const budgetUserPrefs = budgetUserSnap.data()?.financialPreferences;
    const premiumUserPrefs = premiumUserSnap.data()?.financialPreferences;

    console.log("\n🔍 Verification of learned values:");
    console.log(`Budget User Budget Tier: ${budgetUserPrefs?.budgetTier}`);
    console.log(`Budget User Summary (Roman Urdu): "${budgetUserPrefs?.summary}"`);
    console.log(`Premium User Budget Tier: ${premiumUserPrefs?.budgetTier}`);
    console.log(`Premium User Summary (Roman Urdu): "${premiumUserPrefs?.summary}"`);

    if (budgetUserPrefs?.budgetTier !== 'budget') {
      console.warn("⚠️ Warning: Budget user was not classified as 'budget'. (Gemini classified as:", budgetUserPrefs?.budgetTier, ")");
    }
    if (premiumUserPrefs?.budgetTier !== 'premium') {
      console.warn("⚠️ Warning: Premium user was not classified as 'premium'. (Gemini classified as:", premiumUserPrefs?.budgetTier, ")");
    }

    // 5. Test dynamic matchmaker ranking via API chat calls
    console.log("\n📌 Step 5: Testing dynamic matchmaking via API calls...");

    // Call for Budget User
    console.log("\nCalling /api/chat for Budget User...");
    let res = await fetch('http://localhost:5000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: "AC repair karwana hai Islamabad me",
        userId: budgetUserId,
        sessionId: `chat_budget_${Date.now()}`,
        location: "Islamabad"
      })
    });
    let data: any = await res.json();
    console.log(`🤖 Bot Match Reason: "${data.traces?.find((t: any) => t.agent === 'MatchmakerAgent')?.thinking}"`);
    console.log(`Selected Provider: ${data.bestMatch ? data.bestMatch.name : 'None'} (Price: Rs. ${data.bestMatch ? data.bestMatch.pricePerHour : 0})`);
    const budgetMatchId = data.bestMatch?.id;

    // Call for Premium User
    console.log("\nCalling /api/chat for Premium User...");
    res = await fetch('http://localhost:5000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: "AC repair karwana hai Islamabad me",
        userId: premiumUserId,
        sessionId: `chat_premium_${Date.now()}`,
        location: "Islamabad"
      })
    });
    data = await res.json();
    console.log(`🤖 Bot Match Reason: "${data.traces?.find((t: any) => t.agent === 'MatchmakerAgent')?.thinking}"`);
    console.log(`Selected Provider: ${data.bestMatch ? data.bestMatch.name : 'None'} (Price: Rs. ${data.bestMatch ? data.bestMatch.pricePerHour : 0})`);
    const premiumMatchId = data.bestMatch?.id;

    // Call for Budget User but explicitly requesting high-end/premium
    console.log("\nCalling /api/chat for Budget User asking explicitly for Premium/Expensive service...");
    res = await fetch('http://localhost:5000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: "Premium quality expensive AC repair karwana hai Islamabad me",
        userId: budgetUserId,
        sessionId: `chat_budget_override_${Date.now()}`,
        location: "Islamabad"
      })
    });
    data = await res.json();
    console.log(`🤖 Bot Match Reason: "${data.traces?.find((t: any) => t.agent === 'MatchmakerAgent')?.thinking}"`);
    console.log(`Selected Provider: ${data.bestMatch ? data.bestMatch.name : 'None'} (Price: Rs. ${data.bestMatch ? data.bestMatch.pricePerHour : 0})`);
    const budgetOverrideMatchId = data.bestMatch?.id;

    // 6. Final verification
    console.log("\n📌 Step 6: Final assertions...");
    const isStandardCorrect = budgetMatchId === cheapServiceId && premiumMatchId === premiumServiceId;
    const isOverrideCorrect = budgetOverrideMatchId === premiumServiceId;

    if (isStandardCorrect && isOverrideCorrect) {
      console.log("🏆 SUCCESS! Matchmaker correctly routed standard queries according to profiles AND correctly honored the explicit query override!");
    } else {
      console.log(`Budget User Match: ${budgetMatchId} (Expected: ${cheapServiceId})`);
      console.log(`Premium User Match: ${premiumMatchId} (Expected: ${premiumServiceId})`);
      console.log(`Budget User Override Match: ${budgetOverrideMatchId} (Expected: ${premiumServiceId})`);
      console.warn("⚠️ Matchmaker re-ranking did not match perfectly. Check traces for details.");
    }

    // 7. Cleanup
    console.log("\n📌 Step 7: Cleaning up test documents from Firestore...");
    await deleteDoc(doc(db, 'services', cheapServiceId));
    await deleteDoc(doc(db, 'services', premiumServiceId));
    await deleteDoc(doc(db, 'users', budgetUserId));
    await deleteDoc(doc(db, 'users', premiumUserId));
    await deleteDoc(doc(db, 'bookings', bookingBudgetRef.id));
    await deleteDoc(doc(db, 'bookings', bookingPremiumRef.id));

    // Clean up test transactions
    const txQuery = query(collection(db, 'transactions'), where('userId', 'in', [budgetUserId, premiumUserId]));
    const txSnap = await getDocs(txQuery);
    for (const doc of txSnap.docs) {
      await deleteDoc(doc.ref);
    }
    console.log("✅ Cleanup complete.");

  } catch (err: any) {
    console.error("❌ Test script failed with error:", err.message);
  }

  console.log("\n===============================================================");
  console.log("🏁 CUSTOMER LONG-TERM MEMORY INTEGRATION TEST RUN COMPLETED");
  console.log("===============================================================");
}

runCustomerMemoryTest();
