import { callOpenRouter } from '../utils/openRouter';

/**
 * Dynamic Pricing Agent using OpenRouter
 * Calculates fair quotes dynamically: Base Rate + Distance Cost + Urgency Multiplier + Demand Surge - Loyalty Discount
 */
export class PricingAgent {
  async calculateQuote(basePrice: number, userQuery: string, providerLocation: string) {
    const instruction = `
      You are the Dynamic Pricing Engine for Wasila.
      Calculate a fair service quote dynamically based on the following formula:
      Final Quote = Base Rate + Distance Cost + Urgency Multiplier + Demand Surge - Loyalty Discount

      Given:
      - Base Rate: ${basePrice} PKR per hour (or fixed)
      - User Query: "${userQuery}"
      - Provider Location: "${providerLocation}"

      Determine:
      1. Distance Cost: Compute a mock distance fee based on the location (typically 100-300 PKR).
      2. Urgency Multiplier: Increase base price by 10-20% if query implies urgency (e.g., "urgent", "emergency", "foran").
      3. Demand Surge: Apply demand surge (e.g., 50-150 PKR) if peak hours or high demand is implied.
      4. Loyalty Discount: Apply a discount (e.g. 50-100 PKR) if appropriate.
      
      Return ONLY a JSON response:
      {
        "base": number,
        "distanceFee": number,
        "urgencyFee": number,
        "surgeFee": number,
        "discount": number,
        "total": number,
        "breakdown": "Explanation of the pricing"
      }
    `;

    const promptText = `
      Base Price: ${basePrice}
      Query: "${userQuery}"
      Location: "${providerLocation}"
    `;

    try {
      const responseText = await callOpenRouter(instruction, promptText, { isJson: true });
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
      
      return {
        base: parsed.base || basePrice,
        distanceFee: parsed.distanceFee || 0,
        urgencyFee: parsed.urgencyFee || 0,
        surgeFee: parsed.surgeFee || 0,
        discount: parsed.discount || 0,
        total: parsed.total || (basePrice + (parsed.distanceFee || 0) + (parsed.urgencyFee || 0) + (parsed.surgeFee || 0) - (parsed.discount || 0)),
        breakdown: parsed.breakdown || "Standard dynamic pricing applied."
      };
    } catch (error: any) {
      console.warn("[PricingAgent] Failed to compute dynamic pricing, falling back to basic calculation", error.message);
      return {
        base: basePrice,
        distanceFee: 150,
        urgencyFee: 0,
        surgeFee: 0,
        discount: 0,
        total: basePrice + 150,
        breakdown: "Basic pricing with standard distance fee."
      };
    }
  }
}
