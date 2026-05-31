import { db } from './src/firebase';
import { doc, getDoc } from 'firebase/firestore/lite';
import dotenv from 'dotenv';

dotenv.config();

async function checkUser() {
  const uid = 'Zh6j58kiKXPToIfPbCIzykbbSFI3';
  console.log(`Checking profile for UID: ${uid}`);
  
  const userSnap = await getDoc(doc(db, 'users', uid));
  if (userSnap.exists()) {
    console.log("User Profile Data:", JSON.stringify(userSnap.data(), null, 2));
  } else {
    console.log("No profile found for this UID.");
  }
}

checkUser().catch(console.error);
