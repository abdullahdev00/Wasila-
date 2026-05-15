const { BaseAgent } = require('../adk');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

/**
 * Agent 1: Language Parser Agent (Powered by Google Gemini)
 */
class ParserAgent extends BaseAgent {
  constructor() {
    super("Google Gemini Parser");
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "YOUR_MOCK_KEY");
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });
  }

  async run(context) {
    const query = context.input;

    try {
      // System Prompt for Gemini
      const prompt = `
        You are the Language Parser for "Wasila", a service booking app in Pakistan.
        Analyze the following user query which can be in English, Urdu, or Roman Urdu.
        Extract the service category, the intended action, and your confidence score (0-100).
        
        Supported Categories: Plumber, Electrician, AC Mechanic, Maths Tutor, Painter, Carpenter.
        Supported Actions: search, book, dispute.
        
        Return ONLY a JSON object in this format:
        {
          "category": "category_name or null",
          "action": "search/book/dispute",
          "confidence": number,
          "reasoning": "brief explanation"
        }
        
        Query: "${query}"
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return JSON.parse(text);

    } catch (error) {
      console.error("Gemini API Error, falling back to heuristic:", error.message);
      // Fallback logic (Regex) if API fails
      return this.fallbackParser(query);
    }
  }

  fallbackParser(q) {
    let category = null;
    let action = 'search';
    if (q.match(/plumber|nalka/i)) category = 'Plumber';
    if (q.match(/electrician|bijli/i)) category = 'Electrician';
    if (q.match(/book|yes|confirm/i)) action = 'book';
    
    return { 
      category, 
      action, 
      confidence: 50, 
      reasoning: "Heuristic fallback used due to API error." 
    };
  }
}

module.exports = new ParserAgent();
