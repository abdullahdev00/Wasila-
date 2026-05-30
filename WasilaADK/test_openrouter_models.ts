import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY not found!");
    return;
  }

  console.log("Fetching models from OpenRouter...");
  try {
    const res = await axios.get("https://openrouter.ai/api/v1/models", {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });

    const models = res.data.data;
    console.log(`Total models found: ${models.length}`);

    const freeModels = models.filter((m: any) => {
      const isFree = parseFloat(m.pricing?.prompt || '0') === 0 && parseFloat(m.pricing?.completion || '0') === 0;
      return isFree || m.id.endsWith(':free');
    });

    console.log(`--- Active Free Models ---`);
    freeModels.forEach((m: any) => {
      console.log(`ID: ${m.id} | Name: ${m.name}`);
    });
  } catch (err: any) {
    console.error("Error fetching models:", err.response?.data || err.message);
  }
}

run().catch(console.error);
