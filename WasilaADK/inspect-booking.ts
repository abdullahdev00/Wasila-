import { db } from './src/firebase';
import { doc, getDoc } from 'firebase/firestore/lite';
import dotenv from 'dotenv';
dotenv.config();
async function run() {
  const snap = await getDoc(doc(db, 'bookings', 'hUfw8MHK5MoRMauddWBa'));
  console.log("Document data in Firestore:", snap.data());
}
run().catch(console.error);
