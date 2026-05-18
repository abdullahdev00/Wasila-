import { callOpenRouter } from '../utils/openRouter';
import { fetchProvidersFromFirebase } from '../firebase';

/**
 * Matchmaker Agent using OpenRouter & Direct Firebase Queries
 */
export class MatchmakerAgent {
  async findMatch(query: string, category: string) {
    try {
      if (!category) {
        return { bestMatch: null, reasoning: "No category provided." };
      }
      
      const cleanedCategory = category.replace(/^[:\s\p{P}]+|[:\s\p{P}]+$/gu, "").trim();
      console.log(`\n[Matchmaker] Programmatically querying Firebase for category: '${cleanedCategory}'...`);
      const allProviders = await fetchProvidersFromFirebase();
      
      const filteredProviders = allProviders.filter((p: any) => {
        if (!p.category) return false;
        if (p.isBooked) return false;
        
        const dbCat = p.category.toLowerCase();
        const searchCat = cleanedCategory.toLowerCase();
        
        return dbCat.includes(searchCat) || searchCat.includes(dbCat) || dbCat.substring(0, 5) === searchCat.substring(0, 5);
      });

      console.log(`[Matchmaker] Found ${filteredProviders.length} candidate(s) in Firebase.`);

      if (filteredProviders.length === 0) {
        return { bestMatch: null, reasoning: "Bara-e-meharbani apna query wazeh karein, is category ka koi provider available nahi hai." };
      }

      const instruction = `
        You are the Matchmaker for Wasila.
        Rank the provided candidates based on their rating, relevance to the user need, and status.
        Return ONLY a JSON object: {"bestMatch": {"id": "string", "name": "string", "rating": number, "category": "string"}, "reasoning": "explanation"}
      `;

      const promptText = `
        User Need: "${query}"
        Category Needed: "${cleanedCategory}"
        Candidates Found in Database:
        ${JSON.stringify(filteredProviders, null, 2)}
      `;

      const responseText = await callOpenRouter(instruction, promptText, { isJson: true });
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : '{"bestMatch": null}');
    } catch (error: any) {
      console.error('Matchmaking Run Error:', error.message);
      return { bestMatch: null, reasoning: error.message };
    }
  }
}
