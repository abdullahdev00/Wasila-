import { db } from './src/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore/lite';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function trigger() {
  console.log("Fetching bookings from Firestore...");
  const snap = await getDocs(collection(db, 'bookings'));
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  // Target user Mohammad (Zh6j58kiKXPTolfPbCIzykbBSFI3)
  const targetUserId = 'Zh6j58kiKXPTolfPbCIzykbBSFI3';
  const myBookings = docs.filter((b: any) => b.userId === targetUserId);
  
  if (myBookings.length === 0) {
    console.log(`No bookings found for UID: ${targetUserId}. Make a booking first via chat!`);
    return;
  }
  
  // Sort by timestamp desc to get the latest booking
  myBookings.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const targetBooking = myBookings[0];
  console.log(`Latest booking found: ID=${targetBooking.id}, Service="${targetBooking.serviceName}", Current Status="${targetBooking.status}"`);
  
  // Force update status to 'accepted' and clear reminderSent
  console.log("Updating booking status to 'accepted' and clearing reminderSent to force a new notification...");
  await updateDoc(doc(db, 'bookings', targetBooking.id), {
    status: 'accepted',
    reminderSent: false
  });
  
  console.log("Triggering /api/reminders check on local server...");
  try {
    const res = await axios.post('http://localhost:5000/api/reminders');
    console.log("\nSuccess! Server Response:", JSON.stringify(res.data, null, 2));
    console.log("\n✔ Your app screen should now display the native Alert popup warning reminder!");
  } catch (err: any) {
    console.error("Failed to trigger local reminders endpoint. Trying live endpoint...");
    try {
      const res = await axios.post('https://wasila-backend-546907715054.us-central1.run.app/api/reminders');
      console.log("\nSuccess using Live URL! Server Response:", JSON.stringify(res.data, null, 2));
      console.log("\n✔ Your app screen should now display the native Alert popup warning reminder!");
    } catch (liveErr: any) {
      console.error("Failed to trigger live endpoint:", liveErr.message);
    }
  }
}

trigger().catch(console.error);
