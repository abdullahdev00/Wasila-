import { db } from './src/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore/lite';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  console.log("Fetching bookings from Firestore...");
  const snap = await getDocs(collection(db, 'bookings'));
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  const targetUserId = 'Zh6j58kiKXPTolfPbCIzykbBSFI3';
  const myBookings = docs.filter((b: any) => b.userId === targetUserId);
  
  if (myBookings.length === 0) {
    console.log(`No bookings found for UID: ${targetUserId}`);
    return;
  }
  
  // Sort by timestamp desc to get the latest booking
  myBookings.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const targetBooking = myBookings[0];
  console.log(`Latest booking found: ID=${targetBooking.id}, Service="${targetBooking.serviceName}", Current Status="${targetBooking.status}"`);
  
  console.log("Updating booking status to 'completed'...");
  await updateDoc(doc(db, 'bookings', targetBooking.id), {
    status: 'completed'
  });
  console.log("\n✔ Success! Booking has been marked as 'completed' in Firestore!");
  console.log("✔ If you are in the Bookings tab on the app, the 5-star Rating Modal should pop up now!");
}

run().catch(console.error);
