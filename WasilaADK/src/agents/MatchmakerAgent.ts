import { callOpenRouter } from '../utils/openRouter';
import { fetchProvidersFromFirebase } from '../firebase';
import { ExternalSearchAgent } from './ExternalSearchAgent';

const externalSearch = new ExternalSearchAgent();

/**
 * Matchmaker Agent using OpenRouter & Direct Firebase Queries
 */
export class MatchmakerAgent {
  async findMatch(query: string, category: string, resolvedLocation: string = 'Islamabad') {
    try {
      if (!category) {
        return { bestMatch: null, reasoning: "No category provided." };
      }
      
      const cleanedCategory = category.replace(/^[:\s\p{P}]+|[:\s\p{P}]+$/gu, "").trim();
      console.log(`\n[Matchmaker] Programmatically querying Firebase for category: '${cleanedCategory}'...`);
      const allProviders = await fetchProvidersFromFirebase();
      
      const filteredProviders = allProviders.filter((p: any) => {
        if (p.isBooked) return false;
        
        const dbCat = (p.category || '').toLowerCase();
        const dbName = (p.serviceName || p.name || '').toLowerCase();
        const dbDesc = (p.description || '').toLowerCase();
        const searchCat = cleanedCategory.toLowerCase();
        const searchQuery = query.toLowerCase();
        
        // Match by category
        const isCatMatch = dbCat.includes(searchCat) || searchCat.includes(dbCat) || (dbCat.substring(0, 4) === searchCat.substring(0, 4));
        
        // Match by service name (e.g. "ac technician" or "plumber")
        const isNameMatch = dbName.includes(searchCat) || searchCat.includes(dbName) || dbName.includes(searchQuery) || searchQuery.includes(dbName);
        
        // Match by description
        const isDescMatch = dbDesc.includes(searchCat) || dbDesc.includes(searchQuery);
        
        return isCatMatch || isNameMatch || isDescMatch;
      });

      console.log(`[Matchmaker] Found ${filteredProviders.length} candidate(s) in Firebase.`);

      if (filteredProviders.length === 0) {
        console.log(`[Matchmaker] No local providers. Delegating to Google Maps search agent for area: ${resolvedLocation}...`);
        return await externalSearch.searchExternalProviders(cleanedCategory, resolvedLocation);
      }

      const instruction = `
        You are the Matchmaker for Wasila.
        Rank the provided candidates based on their rating, relevance to the user need, and status.
        Extract the candidate's serviceName as "name", and the candidate's "name" as "providerName".
        Return ONLY a JSON object: {"bestMatch": {"id": "string", "name": "string", "providerName": "string", "rating": number, "category": "string", "pricePerHour": number, "location": "string"}, "reasoning": "explanation"}
      `;

      const promptText = `
        User Need: "${query}"
        Category Needed: "${cleanedCategory}"
        Candidates Found in Database:
        ${JSON.stringify(filteredProviders, null, 2)}
      `;

      const responseText = await callOpenRouter(instruction, promptText, { isJson: true });
      console.log(`[Matchmaker] Raw LLM response:`, responseText);
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : '{"bestMatch": null}');
    } catch (error: any) {
      console.error('Matchmaking Run Error:', error.message);
      return { bestMatch: null, reasoning: error.message };
    }
  }
}
