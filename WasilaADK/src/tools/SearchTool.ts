import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { fetchProvidersFromFirebase } from '../firebase';

/**
 * ADK Tool: Database Searcher
 * Empowers agents to autonomously fetch real-time service providers.
 */
export const searchTool = new FunctionTool({
  name: 'search_firebase_providers',
  description: 'Searches the Firebase database for available service providers by category.',
  parameters: z.object({
    category: z.string().describe('The specific service category to search for (e.g., Plumber, Electrician).'),
  }),
  execute: async ({ category }) => {
    try {
      console.log(`\n[Search Tool] Fetching '${category}' from Firebase...`);
      const providers = await fetchProvidersFromFirebase();
      const results = providers.filter(p => {
        if (!p.category) return false;
        if (p.isBooked) return false;
        
        const dbCat = p.category.toLowerCase();
        const searchCat = category.toLowerCase();
        
        // Match if one includes the other, or if the first 5 characters match (e.g. Plumb)
        return dbCat.includes(searchCat) || searchCat.includes(dbCat) || dbCat.substring(0, 5) === searchCat.substring(0, 5);
      });
      
      console.log(`[Search Tool] Found ${results.length} results.`);
      return { 
        status: 'success', 
        count: results.length,
        results: results 
      };
    } catch (error: any) {
      console.error("[Search Tool] Error:", error.message);
      return { status: 'error', message: error.message };
    }
  },
});
