import { collection, getDocs, query, where } from 'firebase/firestore/lite';
import axios from 'axios';
import dotenv from 'dotenv';
import { db } from './src/firebase.ts';

dotenv.config();

async function cancelLatestBooking() {
  console.log("=== Simulating Provider Cancellation (Proactive Recovery) ===");
  const providerId = "M2Zv0EPcfUPiuII7ssiTFaOm7J33";
  const PORT = process.env.PORT || 5000;
  const BASE_URL = `http://localhost:${PORT}/api`;

  // 1. Find the latest accepted/pending booking for Shafeeq
  const q = query(collection(db, 'bookings'), where('providerId', '==', providerId));
  const snap = await getDocs(q);

  if (snap.empty) {
    console.error("Error: No bookings found for Shafeeq!");
    return;
  }

  // Sort by timestamp descending to find latest
  const sortedDocs = snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const latestBooking = sortedDocs[0];
  console.log(`Latest booking found: ID ${latestBooking.id} | Status: ${latestBooking.status} | Price: Rs. ${latestBooking.price}`);

  if (latestBooking.status === 'completed' || latestBooking.status === 'cancelled_by_provider') {
    console.error(`Error: Latest booking is already in status '${latestBooking.status}'! Cannot cancel.`);
    return;
  }

  // 2. Call the provider-cancel endpoint
  const url = `${BASE_URL}/bookings/${latestBooking.id}/provider-cancel`;
  console.log(`Sending POST request to cancel endpoint: ${url}`);
  
  try {
    const res = await axios.post(url);
    console.log("Cancellation response from server:", res.data);
    console.log("\n✔ Proactive Recovery successfully triggered!");
  } catch (error: any) {
    console.error("Error calling cancel API:", error.response?.data || error.message);
  }
}

cancelLatestBooking().catch(err => {
  console.error("Failed to run cancellation:", err);
});
