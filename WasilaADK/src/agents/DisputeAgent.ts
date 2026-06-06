import { callOpenRouter } from '../utils/openRouter';

/**
 * Dispute Resolution Agent using OpenRouter
 */
export class DisputeAgent {
  async evaluateDispute(
    issueType: 'overcharge' | 'no_show' | 'late_arrival' | 'poor_quality',
    details: string,
    bookingData: any
  ) {
    const instruction = `
      You are the Dispute Resolution Arbitrator for Wasila.
      Evaluate the customer's complaint regarding their service booking and decide if it is valid.
      
      We handle the following issue types:
      
      1. "no_show" (Provider did not show up):
         - Check the booking status in the provided details. If the booking status is 'pending', 'accepted', or 'rescheduled' (meaning the provider never marked "arrived" or "completed") and the scheduled time has passed, the dispute is automatically VALID.
         - For valid no-show disputes, return action: "refund_full", refundAmount: ${bookingData.price || 0}, providerPenalty: 15.
         
      2. "overcharge" (Provider charged more than agreed price):
         - Compare the agreed booking price: Rs. ${bookingData.price || 0} against the customer's explanation.
         - The customer's explanation will mention how much the provider actually charged or demanded (e.g., "Rs. 2000 liye", "extra 500 maang raha hai").
         - Extract the provider's charged/demanded price from the explanation. If it exceeds the agreed booking price, the dispute is VALID.
         - If the booking status is 'completed' (meaning the base payment has already been released), the customer has paid the extra amount. Return action: "refund_difference", refundAmount: (actual charged price - agreed booking price), providerPenalty: 0.
         - If the booking status is NOT 'completed' (e.g. 'accepted', 'arrived', 'pending') and the provider is demanding extra cash before finishing the job, return action: "refund_full" (cancelling the booking and refunding customer's escrow hold), refundAmount: ${bookingData.price || 0}, providerPenalty: 15.
         - If details are unclear or the provider did not overcharge, return action: "reject", isValid: false, refundAmount: 0.

      Return ONLY a JSON response in the following schema:
      {
        "isValid": boolean,          // Whether the customer's complaint is approved
        "refundAmount": number,      // Price to refund (the overcharged difference or full booking price depending on action)
        "providerPenalty": number,   // Reliability score deduction percentage (15 for no_show or cancellation, 0 for difference refund)
        "verdictSummary": "string",  // A highly friendly explanation of the decision in Roman Urdu (English alphabet only, no Urdu Nastaliq or Arabic letters) explaining the resolution (e.g., refunding the overcharged difference or cancelling and refunding the booking).
        "action": "refund_full" | "refund_difference" | "reject"
      }
    `;

    const promptText = `
      Dispute Details:
      - Issue Type: "${issueType}"
      - Customer's Explanation: "${details}"
      
      Booking Data:
      - Booking ID: "${bookingData.id}"
      - Status: "${bookingData.status}"
      - Price: Rs. ${bookingData.price}
      - Date/Time: "${bookingData.date}"
      - Scheduled Timestamp: ${bookingData.scheduledTimestamp}
      - Current Timestamp: ${Date.now()}
    `;

    try {
      const responseText = await callOpenRouter(instruction, promptText, { isJson: true });
      const match = responseText.match(/\{[\s\S]*\}/);
      const decision = JSON.parse(match ? match[0] : '{"isValid": false, "refundAmount": 0, "providerPenalty": 0, "verdictSummary": "Maazrat, aap ki request check nahi ho saki.", "action": "reject"}');
      
      return decision;
    } catch (error: any) {
      console.error('[DisputeAgent] Error evaluating dispute:', error.message);
      return {
        isValid: false,
        refundAmount: 0,
        providerPenalty: 0,
        verdictSummary: `Maazrat, technical error ki wajah se dispute process nahi ho saka: ${error.message}`,
        action: "reject"
      };
    }
  }
}

