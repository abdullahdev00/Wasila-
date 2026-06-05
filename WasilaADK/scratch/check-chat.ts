import { db } from '../src/firebase.ts';
import { doc, getDoc } from 'firebase/firestore/lite';

async function checkChat() {
  const chatSessionId = "chat_Zh6j58kiKXPTolfPbCIzykbBSFI3_1780651319045";
  console.log(`Fetching chat session: ${chatSessionId}...`);
  const chatRef = doc(db, 'chats', chatSessionId);
  const snap = await getDoc(chatRef);
  
  if (!snap.exists()) {
    console.error("Chat session not found!");
    return;
  }
  
  const data = snap.data();
  const messages = data.messages || [];
  console.log(`Total messages in session: ${messages.length}`);
  console.log("\nLast 5 messages:");
  messages.slice(-5).forEach((m: any, idx: number) => {
    console.log(`[${idx + 1}] Sender: ${m.sender} | Timestamp: ${m.timestamp}`);
    console.log(`    Text: "${m.text}"`);
    if (m.bestMatch) {
      console.log(`    Best Match resolved: ${m.bestMatch.providerName || m.bestMatch.name} (ID: ${m.bestMatch.id})`);
    }
  });
}

checkChat().catch(console.error);
