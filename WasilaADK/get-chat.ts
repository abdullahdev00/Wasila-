import { collection, getDocs, doc, getDoc } from 'firebase/firestore/lite';
import dotenv from 'dotenv';
import { db } from './src/firebase.ts';

dotenv.config();

async function getChatHistory() {
  const userId = "Zh6j58kiKXPTolfPbCIzykbBSFI3";
  console.log(`Searching for chats of user: ${userId}`);
  
  const allChatsSnap = await getDocs(collection(db, 'chats'));
  const userChats = allChatsSnap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter((chat: any) => chat.userId === userId);

  if (userChats.length === 0) {
    console.log("No chats found for this user!");
    return;
  }

  // Sort by updatedAt or get the latest one
  const latestChat: any = userChats.sort((a: any, b: any) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())[0];
  
  console.log(`\n=== Latest Chat Session: ${latestChat.id} ===`);
  const messages = latestChat.messages || [];
  console.log(`Total messages: ${messages.length}`);
  
  // Print the last 3 messages
  const lastMessages = messages.slice(-3);
  lastMessages.forEach((msg: any, idx: number) => {
    console.log(`\n[Message ${idx + 1}] Sender: ${msg.sender}`);
    console.log(`Text: ${msg.text}`);
    if (msg.bestMatch) {
      console.log(`Proposed Match: ${msg.bestMatch.providerName || msg.bestMatch.name} | Discounted Price: Rs. ${msg.bestMatch.pricePerHour}`);
    }
  });
}

getChatHistory().catch(console.error);
