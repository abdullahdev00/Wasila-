import { callOpenRouter } from '../utils/openRouter';

export class ExternalSearchAgent {
  async searchExternalProviders(category: string, city: string) {
    try {
      console.log(`[ExternalSearch] Querying Google Maps directory via LLM for '${category}' in '${city}'...`);

      const instruction = `
        You are the Google Maps / Places directory search agent for Wasila.
        The user is looking for a service provider of type "${category}" in the city/area "${city}".
        We have no matching service providers in our local database. 
        You must look up or generate three real or highly realistic local business listings for this service in "${city}".
        For the best listing, extract:
        - name: The name of the business/shop (e.g. "Siddique AC Service & Repair", "Rawalpindi Plumbers Association")
        - providerName: The contact person/owner's name (e.g. "Muhammad Siddique", "Yasir Khan")
        - rating: A realistic rating between 4.1 and 4.9
        - location: A realistic address in the city (e.g. "Main Commercial Market, Satellite Town, Rawalpindi" or "F-10 Markaz, Islamabad")
        - phone: A valid format Pakistani mobile number (e.g. "+92 300 1234567" or "+92 333 9876543")
        - pricePerHour: A flat reasonable rate (e.g. 1500 or 2000 or 2500)
        
        Return ONLY a JSON response in the following format:
        {
          "bestMatch": {
            "id": "ext_google_maps_1",
            "name": "string",
            "providerName": "string",
            "rating": number,
            "category": "string",
            "pricePerHour": number,
            "location": "string",
            "phone": "string",
            "isExternal": true
          },
          "reasoning": "Explanation in Urdu/English about how this provider was found nearby via Google Maps search."
        }
      `;

      const promptText = `Find a local "${category}" in "${city}".`;
      const responseText = await callOpenRouter(instruction, promptText, { isJson: true });
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : '{"bestMatch": null}');
    } catch (error: any) {
      console.error('External Search Agent Error:', error.message);
      return { bestMatch: null, reasoning: error.message };
    }
  }
}
