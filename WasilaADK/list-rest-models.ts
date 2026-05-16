import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

async function listModels() {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
    const res = await axios.get(url);
    console.log("--- Available Models ---");
    res.data.models.forEach((m: any) => console.log(m.name));
  } catch (e: any) {
    console.error("REST Error:", e.response?.data || e.message);
  }
}

listModels();
