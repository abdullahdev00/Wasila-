const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  try {
    // We try to use a generic model to see if it even connects
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent("test");
    console.log("Connection successful");
  } catch (e) {
    console.log("Error details:", JSON.stringify(e, null, 2));
  }
}

listModels();
