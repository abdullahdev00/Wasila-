import { callOpenRouter } from '../utils/openRouter';

export interface NegotiationProposal {
  category: string;
  serviceName: string;
  dateTime: string;
  location: string;
  proposedPrice: number;
  basePrice?: number;
}

export class SupplierAgent {
  async evaluateProposal(
    providerName: string,
    providerInstructions: string,
    proposal: NegotiationProposal,
    negotiationHistory: string[]
  ) {
    const originalBasePrice = proposal.basePrice || proposal.proposedPrice;
    const defaultInstructions = `
      - Working hours: 9:00 AM to 6:00 PM.
      - Base price is firm. You may offer a counter-offer if the proposed price is lower than the base price of Rs. ${originalBasePrice}.
      - Sunday is a holiday. Do not accept Sunday bookings.
      - If requested date is Sunday, suggest Saturday or Monday instead.
      - Respond friendly in Roman Urdu or English.
    `;

    const instructionsToUse = providerInstructions && providerInstructions.trim() 
      ? providerInstructions 
      : defaultInstructions;

    const systemPrompt = `
      You are the AI representative agent for the service provider "${providerName}".
      Your goal is to evaluate booking requests from the Wasila Customer Agent according to your business rules.

      Your Business Rules & Availability Constraints:
      ${instructionsToUse}

      Here is the customer proposal:
      - Service: "${proposal.serviceName}" (${proposal.category})
      - Requested Date/Time: "${proposal.dateTime}"
      - Customer Location: "${proposal.location}"
      - Base Price of Service: Rs. ${originalBasePrice}
      - Proposed Price: Rs. ${proposal.proposedPrice}

      Negotiation History so far:
      ${negotiationHistory.length > 0 ? negotiationHistory.join('\n') : 'No previous turns.'}

      Evaluate if you can accept this proposal. If the time/date violates your rules, or the price is too low, you MUST make a counter_offer with updated price and/or timing.
      If it is completely unacceptable and cannot be resolved, you can choose "rejected".
      Otherwise, if everything looks good, choose "accepted".

      You MUST respond ONLY with a JSON object:
      {
        "status": "accepted" | "counter_offer" | "rejected",
        "negotiatedPrice": number,
        "negotiatedDateTime": "string",
        "reasoning": "Brief explanation in Roman Urdu or English explaining your decision (keep it under 2 sentences)"
      }
    `;

    const userPrompt = `Evaluate the proposal and respond with the required JSON.`;

    try {
      const responseText = await callOpenRouter(systemPrompt, userPrompt, { isJson: true });
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');

      return {
        status: parsed.status || 'accepted',
        negotiatedPrice: Number(parsed.negotiatedPrice) || proposal.proposedPrice,
        negotiatedDateTime: parsed.negotiatedDateTime || proposal.dateTime,
        reasoning: parsed.reasoning || 'Looks good, I accept the offer.'
      };
    } catch (error: any) {
      console.warn("[SupplierAgent] Evaluation failed, defaulting to accepted", error.message);
      return {
        status: 'accepted',
        negotiatedPrice: proposal.proposedPrice,
        negotiatedDateTime: proposal.dateTime,
        reasoning: 'Agreed with the proposed details.'
      };
    }
  }
}
