const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function test() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Hello");
    const response = await result.response;
    console.log("SUCCESS with 1.5-flash:", response.text());
  } catch (e1) {
    console.log("FAILED with 1.5-flash:", e1.message);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const result = await model.generateContent("Hello");
      const response = await result.response;
      console.log("SUCCESS with gemini-pro:", response.text());
    } catch (e2) {
      console.log("FAILED with gemini-pro:", e2.message);
    }
  }
}

test();
