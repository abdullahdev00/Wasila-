import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY not found!");
    return;
  }

  const endpoint = "https://openrouter.ai/api/v1/chat/completions";
  console.log("Calling OpenRouter with google/gemini-2.5-flash...");
  try {
    const res = await axios.post(
      endpoint,
      {
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Hello" }
        ],
        temperature: 0.1,
        max_tokens: 400
      },
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("Response:", JSON.stringify(res.data, null, 2));
  } catch (err: any) {
    console.error("Error calling model:", err.response?.data || err.message);
  }
}

run().catch(console.error);
