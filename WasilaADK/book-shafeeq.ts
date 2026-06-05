import { collection, addDoc, getDocs, query, where } from 'firebase/firestore/lite';
import dotenv from 'dotenv';
import { db } from './src/firebase.ts';

dotenv.config();

async function bookShafeeq() {
  console.log("=== Creating Test Booking for Shafeeq ===");
  const providerId = "M2Zv0EPcfUPiuII7ssiTFaOm7J33";
  const customerId = "Zh6j58kiKXPTolfPbCIzykbBSFI3";

  // 1. Find Shafeeq's service
  const q = query(collection(db, 'services'), where('providerId', '==', providerId));
  const snap = await getDocs(q);

  if (snap.empty) {
    console.error("Error: Shafeeq's service not found in Firestore services collection!");
    return;
  }

  const serviceDoc = snap.docs[0];
  const serviceData = serviceDoc.data();
  console.log(`Found service: "${serviceData.name}" by "${serviceData.providerName || serviceData.name}" (ID: ${serviceDoc.id})`);

  // 2. Calculate scheduled timestamp for 7:30 PM today PKT
  const now = new Date();
  const scheduled = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 30, 0, 0);
  const scheduledTimestamp = scheduled.getTime();

  // 3. Create booking document in bookings collection
  const bookingData = {
    providerId: providerId,
    providerName: serviceData.providerName || serviceData.name || "Shafeeq",
    serviceId: serviceDoc.id,
    serviceName: serviceData.name,
    category: serviceData.category || "Repair",
    userId: customerId,
    userName: "Test Customer",
    price: serviceData.price || 1200,
    status: "pending",
    date: "Today, 7:30 PM",
    timestamp: new Date().toISOString(),
    scheduledTimestamp: scheduledTimestamp,
    notes: "Direct test booking created at 7:30 PM today."
  };

  console.log("Creating booking document in Firestore:", bookingData);
  const docRef = await addDoc(collection(db, 'bookings'), bookingData);
  console.log(`Successfully created booking! Document ID: ${docRef.id}`);
}

bookShafeeq().catch(err => {
  console.error("Failed to run booking:", err);
});
