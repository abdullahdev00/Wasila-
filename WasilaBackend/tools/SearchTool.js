const { FunctionTool } = require('@google/adk');
const { z } = require('zod');
const { fetchProvidersFromFirebase } = require('../firebase');

/**
 * Tool: Service Provider Search Tool
 * Allows agents to autonomously search for providers in the database.
 */
const searchTool = new FunctionTool({
  name: 'search_providers',
  description: 'Searches the database for available service providers based on category.',
  parameters: z.object({
    category: z.string().describe('The service category to search for (e.g., Plumber, Electrician).'),
  }),
  execute: async ({ category }) => {
    try {
      console.log(`[Tool] Searching for: ${category}`);
      const providers = await fetchProvidersFromFirebase();
      const results = providers.filter(p => 
        p.category.toLowerCase().includes(category.toLowerCase()) && !p.isBooked
      );
      
      return { 
        status: 'success', 
        count: results.length,
        results: results 
      };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  },
});

module.exports = searchTool;
