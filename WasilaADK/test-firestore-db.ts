import { db } from './src/firebase.js';

async function verifyFirestoreDatabaseId() {
  console.log("Checking Firestore Configuration...");
  
  // Retrieve DB ID dynamically from our Firebase DB instance
  // @ts-ignore - accessing internal structure for confirmation
  const dbId = db._databaseId?.database || "(default)";
  // @ts-ignore
  const projectId = db._databaseId?.projectId || "wasila-4d23e";
  
  console.log("=========================================");
  console.log(`✅ Project ID:   ${projectId}`);
  console.log(`✅ Database ID:  ${dbId}`);
  console.log(`🔗 GCP Resource Path: projects/${projectId}/databases/${dbId}`);
  console.log("=========================================");
  console.log("Use the Database ID above in Vertex AI Console!");
}

verifyFirestoreDatabaseId();
