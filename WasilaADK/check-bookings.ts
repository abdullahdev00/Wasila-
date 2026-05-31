import { db } from './src/firebase';
import { collection, getDocs } from 'firebase/firestore/lite';

async function checkBookings() {
  console.log("Fetching all bookings from Firestore...");
  const bookingsCol = collection(db, 'bookings');
  const snap = await getDocs(bookingsCol);
  console.log(`Total bookings found: ${snap.size}`);
  snap.forEach(d => {
    console.log(`- Booking ID: ${d.id}`);
    console.log(JSON.stringify(d.data(), null, 2));
  });
}

checkBookings().catch(console.error);
