import { db } from './firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore/lite';

async function cleanDB() {
  console.log("Cleaning up test documents...");
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    let deletedUsers = 0;
    for (const d of usersSnap.docs) {
      if (d.id.startsWith('test-wallet-user-') || d.id.startsWith('test-user-')) {
        await deleteDoc(doc(db, 'users', d.id));
        deletedUsers++;
      }
    }
    console.log(`Deleted ${deletedUsers} test user documents.`);

    const servicesSnap = await getDocs(collection(db, 'services'));
    let deletedServices = 0;
    for (const d of servicesSnap.docs) {
      if (d.id.startsWith('test-service-')) {
        await deleteDoc(doc(db, 'services', d.id));
        deletedServices++;
      }
    }
    console.log(`Deleted ${deletedServices} test service documents.`);
    console.log("Cleanup finished.");
  } catch (err: any) {
    console.error("Cleanup failed:", err.message);
  }
}

cleanDB();
