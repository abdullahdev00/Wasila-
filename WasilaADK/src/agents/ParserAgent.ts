import { callOpenRouter } from '../utils/openRouter';

/**
 * Intent Parser Agent using OpenRouter
 */
export class ParserAgent {
  async parse(query: string) {
    const instruction = `
      You are the Intent Parser for Wasila. 
      Extract the following fields from the user's query:
      - category (e.g., Plumber, Electrician, AC Mechanic, Maths Tutor, Painter, Carpenter)
      - action (search, book, dispute)
      - confidence (0-100)
      
      Return ONLY a JSON object: {"category": string | null, "action": string | null, "confidence": number}
    `;

    try {
      const responseText = await callOpenRouter(instruction, query, { isJson: true });
      const cleanJsonStr = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJsonStr || '{"category": null, "action": null, "confidence": 0}');
      if (parsed.category) {
        // Remove leading/trailing colons, spaces, and punctuation
        parsed.category = parsed.category.replace(/^[:\s\p{P}]+|[:\s\p{P}]+$/gu, "").trim();
      }
      return parsed;
    } catch (error: any) {
      console.error('Parser Run Error:', error.message);
      return { category: null, action: null, confidence: 0, error: error.message };
    }
  }
}
