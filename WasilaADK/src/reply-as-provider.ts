import { doc, getDocs, collection, query, where, updateDoc, arrayUnion } from 'firebase/firestore/lite';
import { db } from './firebase';

async function replyAsProvider() {
  const customerUserId = "Zh6j58kiKXPTolfPbCIzykbBSFI3";
  console.log(`🔍 Querying active chat sessions for customer: ${customerUserId}...`);

  const q = query(
    collection(db, 'chats'),
    where('userId', '==', customerUserId)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    console.log("❌ No chat sessions found for this user.");
    return;
  }

  const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  // Sort in memory by updatedAt descending
  docs.sort((a: any, b: any) => {
    const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return timeB - timeA;
  });

  const latestChat: any = docs[0];
  console.log(`\n📌 Found Active Chat Session: "${latestChat.id}"`);
  console.log(`Provider Matched: ${latestChat.providerName} (${latestChat.providerId})`);
  console.log(`Direct Chat Active: ${latestChat.directChatActive}`);

  if (!latestChat.messages || latestChat.messages.length === 0) {
    console.log("No messages in chat session.");
    return;
  }

  console.log("\n💬 Latest Messages:");
  latestChat.messages.slice(-5).forEach((msg: any) => {
    console.log(` - [${msg.sender}] ${msg.text}`);
  });

  // Check if direct chat is active
  if (latestChat.directChatActive !== true) {
    console.warn("⚠️ Direct chat is not currently marked active in this session. Activating it now for the test...");
    await updateDoc(doc(db, 'chats', latestChat.id), { directChatActive: true });
  }

  // Send reply from Sajid Khan
  const replyText = "Ji bilkul, main Sajid Khan baat kar raha hoon. Aap ka AC kab check karna hai?";
  console.log(`\n✉️ Sending reply from Sajid Khan: "${replyText}"...`);

  await updateDoc(doc(db, 'chats', latestChat.id), {
    messages: arrayUnion({
      id: `prov_msg_${Date.now()}`,
      sender: 'provider',
      text: replyText,
      timestamp: new Date().toISOString()
    }),
    lastMessage: replyText,
    updatedAt: new Date().toISOString()
  });

  console.log("✅ Message successfully sent! Please check your mobile screen now.");
}

replyAsProvider();
