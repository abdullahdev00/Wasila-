const { BaseAgent } = require('../adk');
const providers = require('../data/providers.json');

/**
 * Agent 3: Ranking Agent
 * Extends ADK BaseAgent.
 */
class RankingAgent extends BaseAgent {
  constructor() {
    super("Intelligent Ranking Agent");
  }

  async run(context) {
    const { category, action } = context.state;
    if (action === 'dispute' || action === 'book') return { rankingCompleted: false };

    let candidates = providers.filter(p => !p.isBooked);
    if (category) {
      candidates = candidates.filter(p => p.category.toLowerCase().includes(category.toLowerCase()));
    }

    const ranked = candidates.map(p => {
      let score = 0;
      score += p.rating * 10;
      score += (p.verified ? 20 : 0);
      score += (20 - Math.min(p.distanceKm, 20));
      score += (p.experienceYears / 2);
      score += 10;
      return { ...p, finalScore: score };
    }).sort((a, b) => b.finalScore - a.finalScore);

    return { bestMatch: ranked[0], candidatesCount: ranked.length };
  }
}

module.exports = new RankingAgent();
