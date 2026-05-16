const { BaseAgent } = require('../adk');
const { fetchProvidersFromFirebase } = require('../firebase');

/**
 * Agent 3: Ranking Agent
 * Implements the 6-Factor Agentic Ranking Engine.
 */
class RankingAgent extends BaseAgent {
  constructor() {
    super("Intelligent Ranking Agent");
  }

  async run(context) {
    const { category, action } = context.state;
    if (action === 'dispute' || action === 'book') return { rankingCompleted: false };

    let providers = await fetchProvidersFromFirebase();
    let candidates = providers.filter(p => !p.isBooked);
    if (category) {
      candidates = candidates.filter(p => p.category.toLowerCase().includes(category.toLowerCase()));
    }

    // Handle "No Provider Found" scenario
    if (candidates.length === 0) {
      return {
        bestMatch: null,
        error: "NO_PROVIDER_FOUND",
        fallbackSuggestion: "Maazrat! Filhal is category mein koi provider available nahi hai. Kya main aapka naam waitlist mein daal doon?"
      };
    }

    const ranked = candidates.map(p => {
      let score = 0;
      score += p.rating * 10;           // 1. Rating (Quality)
      score += (p.verified ? 20 : 0);   // 2. Verification (Trust)
      score += (20 - Math.min(p.distanceKm, 20)); // 3. Proximity (Speed)
      score += (p.experienceYears / 2); // 4. Experience (Expertise)
      score += (p.availabilityScore / 5); // 5. Availability (Reliability)
      score += (10 - (p.cancellationRate / 2)); // 6. Cancellation Rate (Commitment)

      return { ...p, finalScore: score };
    }).sort((a, b) => b.finalScore - a.finalScore);

    return { bestMatch: ranked[0], candidatesCount: ranked.length };
  }
}

module.exports = new RankingAgent();
