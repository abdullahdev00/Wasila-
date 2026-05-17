import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from 'dotenv';
dotenv.config();

const keys = [
  "AIzaSyDlrH6q5QLKjj4-oYYUT8MFHzn55EYVzig", // Firebase Key from .env
  "AIzaSyDAul4NkqUfgZbHH4Vg6FS8Df7PoZ8hraA", // Google Maps Key from app.json
  "AIzaSyAzh-qPx6CWTBRmVGCpXZpi_vYnP92zVXw",  // Original Key
  "AIzaSyDqfDDNxgSnmYxDq4An5ftpE6pWLwNBVJU"  // Discovered key in WasilaBackend/.env
];

async function testKeys() {
  for (const key of keys) {
    console.log(`\nTesting Key: ${key.substring(0, 10)}...`);
    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent("Say 'Hello' in Roman Urdu.");
      console.log(`✅ SUCCESS! Response: "${result.response.text().trim()}"`);
    } catch (e: any) {
      console.log(`❌ FAILED: ${e.message}`);
    }
  }
}

testKeys();
