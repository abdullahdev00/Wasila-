import { doc, getDoc, collection, getDocs, query, where, deleteDoc } from 'firebase/firestore/lite';
import { db } from './firebase';

async function runDirectChatTest() {
  console.log("===============================================================");
  console.log("🚀 WASILA AI: DIRECT CUSTOMER-TO-PROVIDER CHAT TEST SUITE");
  console.log("===============================================================");

  const userId = "test-customer-dc";
  const sessionId = `chat_test_dc_${Date.now()}`;

  try {
    // 1. Send search query to match a provider
    console.log("\n📌 Step 1: Customer searches for AC Repair in Pakpattan...");
    let res = await fetch('http://localhost:5000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: "Pakpattan me AC repair krwana hai",
        userId,
        sessionId,
        location: "Pakpattan"
      })
    });
    let data: any = await res.json();
    console.log(`🤖 Bot Reply: "${data.reply}"`);
    console.log(`Matched Provider: ${data.bestMatch ? data.bestMatch.name : 'None'}`);

    if (!data.bestMatch) {
      throw new Error("Matchmaker failed to find a provider. Test aborted.");
    }

    // 2. Request direct chat connection
    console.log("\n📌 Step 2: Customer requests to speak directly to the provider...");
    res = await fetch('http://localhost:5000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: "Meri issy baat krwado please",
        userId,
        sessionId
      })
    });
    data = await res.json();
    console.log(`🤖 Bot Reply: "${data.reply}"`);

    // 3. Verify Firestore chat session document
    console.log("\n📌 Step 3: Verifying Firestore chat session state...");
    const chatDocSnap = await getDoc(doc(db, 'chats', sessionId));
    if (chatDocSnap.exists()) {
      const chatData = chatDocSnap.data();
      console.log(`Firestore directChatActive: ${chatData.directChatActive}`);
      console.log(`Firestore providerId: ${chatData.providerId}`);
      console.log(`Firestore providerName: ${chatData.providerName}`);
      
      if (chatData.directChatActive === true && chatData.providerId) {
        console.log("✅ Firestore session state successfully updated!");
      } else {
        console.error("❌ Firestore session state verification failed.");
      }
    } else {
      console.error("❌ Chat document not found in Firestore.");
    }

    // 4. Verify Firestore notifications collection
    console.log("\n📌 Step 4: Verifying Firestore notifications for provider...");
    const notifQuery = query(
      collection(db, 'notifications'),
      where('sessionId', '==', sessionId),
      where('type', '==', 'direct_chat')
    );
    const notifSnap = await getDocs(notifQuery);
    if (!notifSnap.empty) {
      notifSnap.forEach((doc) => {
        const notifData = doc.data();
        console.log(`✅ Notification Target Provider ID: ${notifData.userId}`);
        console.log(`✅ Notification Message: "${notifData.message}"`);
      });
    } else {
      console.error("❌ No direct chat notifications found in Firestore.");
    }

    // 5. Clean up test records
    console.log("\n📌 Step 5: Cleaning up test documents...");
    await deleteDoc(doc(db, 'chats', sessionId));
    const notifSnapshot = await getDocs(notifQuery);
    for (const doc of notifSnapshot.docs) {
      await deleteDoc(doc.ref);
    }
    console.log("✅ Cleanup complete.");

  } catch (error: any) {
    console.error("❌ Test failed with error:", error.message);
  }

  console.log("\n===============================================================");
  console.log("🏁 DIRECT CHAT TEST RUN COMPLETED");
  console.log("===============================================================");
}

runDirectChatTest();
