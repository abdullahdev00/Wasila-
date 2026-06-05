import { db } from '../src/firebase.ts';
import { collection, getDocs, query, where } from 'firebase/firestore/lite';

async function checkLatest() {
  const userId = "Zh6j58kiKXPTolfPbCIzykbBSFI3";
  console.log(`Fetching bookings for user: ${userId}...`);
  const bookingsCol = collection(db, 'bookings');
  const q = query(bookingsCol, where('userId', '==', userId));
  const snap = await getDocs(q);
  
  const bookings = snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as any));
  
  // Sort by timestamp descending or status
  bookings.sort((a: any, b: any) => {
    return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
  });
  
  console.log(`Found ${bookings.length} bookings. Top 5 latest bookings:`);
  bookings.slice(0, 5).forEach(b => {
    console.log(`\n- Booking ID: ${b.id}`);
    console.log(`  Provider: ${b.providerName} (ID: ${b.providerId})`);
    console.log(`  Service: ${b.serviceName} (${b.category})`);
    console.log(`  Price: Rs. ${b.price}`);
    console.log(`  Status: ${b.status}`);
    console.log(`  Date: ${b.date}`);
    console.log(`  Timestamp: ${b.timestamp}`);
    console.log(`  Notes: ${b.notes || ''}`);
  });
}

checkLatest().catch(console.error);
