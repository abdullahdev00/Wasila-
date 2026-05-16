import { fetchProvidersFromFirebase } from './src/firebase.js';

async function testDB() {
  console.log("Fetching data from Firebase...");
  try {
    const data = await fetchProvidersFromFirebase();
    console.log(`Found ${data.length} providers.`);
    if (data.length > 0) {
      console.log("First provider:", data[0]);
    }
  } catch (e: any) {
    console.error("Firebase Error:", e.message);
  }
}

testDB();
