import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function checkAllModels() {
  try {
    // We can't easily list models without an admin-like key sometimes,
    // but we can try common ones one by one.
    const models = [
      "gemini-1.5-flash-latest",
      "gemini-1.5-pro-latest",
      "gemini-pro",
      "gemini-ultra",
      "gemini-1.0-pro"
    ];

    for (const m of models) {
      try {
        const model = genAI.getGenerativeModel({ model: m });
        const res = await model.generateContent("test");
        console.log(`✅ Model ${m} is working!`);
        return; // Stop if we find one
      } catch (err: any) {
        console.log(`❌ Model ${m} failed: ${err.message}`);
      }
    }
  } catch (e: any) {
    console.error("Fatal Error:", e.message);
  }
}

checkAllModels();
