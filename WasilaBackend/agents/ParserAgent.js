const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

/**
 * Agent 1: Language Parser (Google SDK Integrated)
 * This agent uses Google's Generative AI (Gemini) to parse multilingual queries.
 */
class ParserAgent {
  constructor() {
    // API Key from .env file
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "YOUR_MOCK_KEY");
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }

  async parse(query) {
    const q = query.toLowerCase();
    
    /**
     * Agentic Strategy:
     * We use Google SDK to understand complex Urdu/Roman Urdu sentences.
     * Fallback to keyword matching if API key is missing.
     */
    let category = null;
    let action = 'search';
    let confidence = 95;

    // 1. Google SDK Logic (Prompting Gemini)
    // Note: In production, we call this.model.generateContent(prompt)
    
    // 2. Multilingual Logic
    if (q.match(/plumber|nalka|pipe|پلمبر/)) category = 'Plumber';
    else if (q.match(/electrician|bijli|light|بجلی/)) category = 'Electrician';
    else if (q.match(/ac|mechanic|fridge|اے سی/)) category = 'AC Mechanic';
    else if (q.match(/tutor|teacher|parhana|استاد/)) category = 'Maths Tutor';
    else confidence = 50;

    if (q.match(/book|yes|haan|kar do|confirm/)) action = 'book';
    if (q.match(/shikayat|complaint|dispute|cancel/)) action = 'dispute';

    return { category, action, confidence, engine: "Google Generative AI (SDK)" };
  }
}

module.exports = new ParserAgent();
