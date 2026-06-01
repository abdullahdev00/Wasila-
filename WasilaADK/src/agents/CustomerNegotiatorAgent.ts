import { callOpenRouter } from '../utils/openRouter';

export interface CustomerNegotiationProposal {
  category: string;
  serviceName: string;
  dateTime: string;
  location: string;
  quoteTotal: number;
  proposedPrice: number | null; // From user if they explicitly said it
}

export class CustomerNegotiatorAgent {
  async generateOffer(
    proposal: CustomerNegotiationProposal,
    negotiationHistory: string[],
    lastSupplierOffer: { status: string; price: number; time: string; reasoning: string } | null,
    turn: number,
    maxTurns: number
  ) {
    const minOffer = Math.round(proposal.quoteTotal * 0.75); // opening bid floor
    const targetOffer = Math.round(proposal.quoteTotal * 0.8);  // strategic discount target

    const systemPrompt = `
      You are the AI Negotiation Agent representing the Customer. 
      Your goal is to negotiate the best possible price (discount) for the customer for the service "${proposal.serviceName}" (${proposal.category}).

      Context:
      - Platform Base Quote: Rs. ${proposal.quoteTotal}
      - Booking DateTime: "${proposal.dateTime}"
      - Customer Location: "${proposal.location}"

      Negotiation History so far:
      ${negotiationHistory.length > 0 ? negotiationHistory.join('\n') : 'This is the first turn. Make your opening offer.'}

      Last Supplier Offer:
      ${lastSupplierOffer ? `Status: ${lastSupplierOffer.status} | Price: Rs. ${lastSupplierOffer.price} | Time: ${lastSupplierOffer.time} | Reason: ${lastSupplierOffer.reasoning}` : 'None'}

      Rules:
      1. Opening Offer (Turn 1):
         - If the user explicitly requested a price (proposal.proposedPrice is Rs. ${proposal.proposedPrice}), you MUST propose that exact price as your opening offer.
         - If proposal.proposedPrice is null (fully autonomous A2A), propose a discounted price (e.g. around Rs. ${targetOffer}).
      2. Counter Offer (Turn 2):
         - If the Supplier countered with a price (e.g., Rs. X), evaluate it.
         - If the countered price is reasonable (at or below Rs. ${proposal.quoteTotal}), you can counter-propose slightly higher than your last bid to meet them in the middle, or accept it if it's the last turn.
         - Provide a brief justification in Roman Urdu or English.
      3. Last Turn Check (Turn ${turn} of ${maxTurns}):
         - If this is turn ${maxTurns} or greater, and the supplier's countered price is at or below the base quote (Rs. ${proposal.quoteTotal}), you should accept it to secure the booking. Do not let the transaction fail.

      You MUST respond ONLY with a JSON object:
      {
        "status": "proposing" | "accepted" | "rejected",
        "negotiatedPrice": number,
        "negotiatedDateTime": "string",
        "reasoning": "Brief explanation in Roman Urdu or English explaining your negotiation logic (keep it under 2 sentences)."
      }
    `;

    const userPrompt = `Generate your response based on current turn context.`;

    try {
      const responseText = await callOpenRouter(systemPrompt, userPrompt, { isJson: true });
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');

      return {
        status: parsed.status || 'proposing',
        negotiatedPrice: Number(parsed.negotiatedPrice) || targetOffer,
        negotiatedDateTime: parsed.negotiatedDateTime || proposal.dateTime,
        reasoning: parsed.reasoning || 'Offering a fair price for booking.'
      };
    } catch (error: any) {
      console.warn("[CustomerNegotiatorAgent] Failed, defaulting to base target", error.message);
      return {
        status: 'proposing',
        negotiatedPrice: targetOffer,
        negotiatedDateTime: proposal.dateTime,
        reasoning: 'Proposing a discounted opening price.'
      };
    }
  }
}
