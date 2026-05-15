const parser = require('./agents/ParserAgent');
const ranker = require('./agents/RankingAgent');
const pricer = require('./agents/PricingAgent');
const actor = require('./agents/ActionAgent');
const providers = require('./data/providers.json');

/**
 * Wasila Master Orchestrator
 * Coordinates between specialized agents to deliver end-to-end service.
 */
class WasilaOrchestrator {
  async processRequest(userQuery) {
    const traces = [];

    // Step 1: Parse Language
    const intent = parser.parse(userQuery);
    traces.push({ step: "Agent 1: Language Parser", detail: `Intent: ${intent.category}, Action: ${intent.action}, Confidence: ${intent.confidence}%` });

    if (intent.confidence < 60) {
      return { reply: "Kya aap batana chahein gy ke aapko kis qisam ki service chahiye?", traces };
    }

    // Step 2: Handle Disputes
    if (intent.action === 'dispute') {
      const response = actor.handleDispute(userQuery);
      traces.push({ step: "Agent 7: Dispute Handler", detail: "Resolving user complaint." });
      return { reply: response, traces };
    }

    // Step 3: Handle Bookings
    if (intent.action === 'book') {
      traces.push({ step: "Agent 5: Action Simulator", detail: "Executing booking simulation." });
      const bestMatch = providers[0]; // For simulation simplification
      const result = actor.simulateBooking(bestMatch);
      return { reply: `Booking Confirmed for ${result.providerName}!`, traces };
    }

    // Step 4: Search & Rank
    traces.push({ step: "Agent 2 & 3: Discovery & Ranking", detail: "Filtering and ranking based on 6 factors." });
    let candidates = providers.filter(p => !p.isBooked);
    if (intent.category) {
      candidates = candidates.filter(p => p.category.toLowerCase().includes(intent.category.toLowerCase()));
    }

    const ranked = ranker.rank(candidates, intent.preference);
    const best = ranked[0];

    // Step 5: Pricing
    const pricing = pricer.calculate(best);
    traces.push({ step: "Agent 4: Pricing Engine", detail: `Calculated quote: ${pricing.total} PKR` });

    return {
      reply: `Mujhy ${best.name} mily hain. Inki total price ${pricing.total} PKR hai.`,
      bestMatch: { ...best, pricing },
      traces: traces,
      suggestion: "Kya main booking confirm kar doon?"
    };
  }
}

module.exports = new WasilaOrchestrator();
