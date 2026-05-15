/**
 * Agent 4: Pricing Agent
 * Calculates dynamic pricing based on distance, urgency, and base rates.
 */
class PricingAgent {
  calculate(provider, isUrgent = false) {
    const base = provider.pricePerHour;
    const distanceFee = Math.round(provider.distanceKm * 50);
    const urgencyMultiplier = isUrgent ? 1.2 : 1.0;
    const urgencyFee = Math.round(base * (urgencyMultiplier - 1));
    const total = base + distanceFee + urgencyFee;

    return { base, distanceFee, urgencyFee, total };
  }
}

module.exports = new PricingAgent();
