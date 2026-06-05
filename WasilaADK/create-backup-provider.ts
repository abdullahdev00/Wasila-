import { collection, addDoc, getDocs, query, where } from 'firebase/firestore/lite';
import dotenv from 'dotenv';
import { db } from './src/firebase.ts';

dotenv.config();

async function createBackupProvider() {
  console.log("=== Creating Backup AC Provider for Islamabad ===");
  const providerId = "test-backup-ac-provider-uid-12345";

  // Check if already exists
  const q = query(collection(db, 'services'), where('providerId', '==', providerId));
  const snap = await getDocs(q);

  if (!snap.empty) {
    console.log("Backup provider already exists in Firestore! Skipping creation.");
    return;
  }

  // Create "Yasir AC Technician" in Islamabad under category "Repair"
  const serviceData = {
    name: "Backup AC Repair & Service",
    providerName: "Yasir AC Technician",
    category: "Repair",
    rating: 4.7,
    price: 1800,
    address: "F11",
    city: "Islamabad ",
    isActive: true,
    reliabilityScore: 100,
    lateArrivals: 0,
    cancellations: 0,
    totalCompletedBookings: 0,
    providerId: providerId,
    providerPhotoURL: "",
    createdAt: new Date()
  };

  console.log("Inserting backup provider to Firestore:", serviceData);
  const docRef = await addDoc(collection(db, 'services'), serviceData);
  console.log(`Successfully created backup provider! Document ID: ${docRef.id}`);
}

createBackupProvider().catch(err => {
  console.error("Failed to create backup provider:", err);
});
