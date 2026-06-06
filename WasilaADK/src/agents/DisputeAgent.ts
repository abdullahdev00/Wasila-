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
      
      Currently, we are handling the "no_show" (Provider did not show up) issue type.
      For No-Show complaints:
      - The customer claims the provider never arrived at their location.
      - Check the booking status in the provided details. If the booking status is 'pending' or 'accepted' (meaning the provider never marked "arrived" or "completed") and the scheduled time has passed, the dispute is automatically VALID.
      
      Return ONLY a JSON response in the following schema:
      {
        "isValid": boolean,          // Whether the customer's complaint is approved
        "refundAmount": number,      // Price to refund (for no_show, return the full booking price: ${bookingData.price || 0})
        "providerPenalty": number,   // Reliability score deduction percentage (for no_show, return 15)
        "verdictSummary": "string",  // A highly friendly explanation of the decision in Roman Urdu (English alphabet only, no Urdu Nastaliq or Arabic letters) explaining that the booking is cancelled and the funds are refunded to their wallet.
        "action": "refund_full" | "reject"
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
