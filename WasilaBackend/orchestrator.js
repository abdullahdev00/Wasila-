const providersData = require('./data/providers.json');

/**
 * Wasila AI Orchestrator
 * This is the 'Brain' that uses Antigravity reasoning to handle service requests.
 */
class WasilaOrchestrator {
  constructor() {
    this.providers = providersData;
  }

  async processRequest(userQuery) {
    const traces = [];
    traces.push({ step: "Analyzing Input", detail: `User Query: "${userQuery}"` });

    // 1. Extract Intent (Mocking NLP/Reasoning for Roman Urdu)
    const intent = this.extractIntent(userQuery);
    traces.push({ step: "Intent Extraction", detail: `Detected Category: ${intent.category || 'Any'}, Preference: ${intent.preference || 'None'}` });

    // 2. Planning (Search Strategy)
    traces.push({ step: "Planning", detail: `Searching database for ${intent.category} providers with ${intent.preference} criteria.` });

    // 3. Tool Execution (Filtering Data)
    let candidates = this.providers;
    if (intent.category) {
      candidates = candidates.filter(p => p.category.toLowerCase().includes(intent.category.toLowerCase()));
    }

    traces.push({ step: "Data Retrieval", detail: `Found ${candidates.length} potential providers.` });

    // 4. Reasoning & Ranking (Agentic Decision Making)
    traces.push({ step: "Reasoning", detail: "Ranking providers based on Rating, Price, and Verification status." });
    
    const rankedProviders = candidates.sort((a, b) => {
      // Logic: Prioritize Verified, then high Rating, then lower Price if preference is 'cheap'
      if (intent.preference === 'sasta' || intent.preference === 'cheap') {
        return a.pricePerHour - b.pricePerHour;
      }
      if (a.verified !== b.verified) return b.verified ? 1 : -1;
      return b.rating - a.rating;
    });

    const bestMatch = rankedProviders[0];
    
    if (bestMatch) {
      traces.push({ 
        step: "Final Decision", 
        detail: `Selected ${bestMatch.name} as the best match. He is ${bestMatch.verified ? 'Verified' : 'Unverified'} with a ${bestMatch.rating} rating.` 
      });
    } else {
      traces.push({ step: "Final Decision", detail: "No suitable provider found for this request." });
    }

    return {
      reply: this.generateResponse(bestMatch, intent),
      bestMatch: bestMatch,
      traces: traces
    };
  }

  extractIntent(query) {
    const q = query.toLowerCase();
    let category = null;
    let preference = null;

    if (q.includes('plumber')) category = 'Plumber';
    if (q.includes('bijli') || q.includes('electrician')) category = 'Electrician';
    if (q.includes('ac') || q.includes('mechanic')) category = 'AC Mechanic';
    if (q.includes('tutor') || q.includes('parhana')) category = 'Maths Tutor';

    if (q.includes('sasta') || q.includes('cheap') || q.includes('kam rate')) preference = 'sasta';
    if (q.includes('best') || q.includes('accha') || q.includes('top')) preference = 'best';

    return { category, preference };
  }

  generateResponse(provider, intent) {
    if (!provider) {
      return "Maazrat! Mujhy aapki requirement ke mutabiq koi provider nahi mila. Kya main kisi aur category mein dhoondoon?";
    }

    if (intent.preference === 'sasta') {
      return `Mujhy sab sy sasta option ${provider.name} mila hai jo ${provider.location} mein hain. Inka rate ${provider.pricePerHour} PKR hai. Kya main booking kar doon?`;
    }

    return `Mujhy behtareen match ${provider.name} mily hain jo ${provider.category} ke expert hain. Inki rating ${provider.rating} hai. Kya aap inhein book karna chahein gy?`;
  }
}

module.exports = new WasilaOrchestrator();
