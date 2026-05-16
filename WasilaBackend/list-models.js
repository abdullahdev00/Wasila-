require('dotenv').config();

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log(data.models.map(m => m.name).filter(n => n.includes('gemini')));
  } catch (err) {
    console.error("Error fetching models:", err);
  }
}

listModels();
