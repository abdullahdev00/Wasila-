import { doc, getDoc } from 'firebase/firestore/lite';
import dotenv from 'dotenv';
import { db } from './src/firebase.ts';

dotenv.config();

async function getBookingStatus() {
  const bookingId = "76gDIN2VtSe4DvAdr6bH";
  console.log(`Checking status of booking: ${bookingId}`);
  const snap = await getDoc(doc(db, 'bookings', bookingId));
  if (snap.exists()) {
    console.log("Booking data:", snap.data());
  } else {
    console.log("Booking not found!");
  }

  const providerId = "M2Zv0EPcfUPiuII7ssiTFaOm7J33";
  // Find Shafeeq's service details
  const serviceSnap = await getDoc(doc(db, 'services', 'OoTni8TPTnFUzApVszOB'));
  if (serviceSnap.exists()) {
    console.log("\nProvider metrics (OoTni8TPTnFUzApVszOB):", serviceSnap.data());
  }
}

getBookingStatus().catch(console.error);
