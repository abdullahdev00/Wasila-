/**
 * Agent 3: Ranking Agent
 * Implements the 6-Factor Agentic Ranking Engine.
 */
class RankingAgent {
  rank(providers, preference) {
    return providers.map(p => {
      let score = 0;
      score += p.rating * 10; // Factor 1: Rating
      score += (p.verified ? 20 : 0); // Factor 2: Verification
      score += (20 - Math.min(p.distanceKm, 20)); // Factor 3: Proximity
      score += (p.experienceYears / 2); // Factor 4: Experience
      score += (preference === 'sasta' ? (5000 - p.pricePerHour) / 100 : p.pricePerHour / 500); // Factor 5: Price
      score += 10; // Factor 6: Availability
      
      return { ...p, finalScore: score };
    }).sort((a, b) => b.finalScore - a.finalScore);
  }
}

module.exports = new RankingAgent();
