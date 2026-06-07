import { callOpenRouter, callOpenRouterMultimodal } from '../utils/openRouter';

/**
 * Dispute Resolution Agent using OpenRouter
 */
export class DisputeAgent {
  async evaluateDispute(
    issueType: 'overcharge' | 'no_show' | 'late_arrival' | 'poor_quality',
    details: string,
    bookingData: any,
    beforeImage?: string,
    afterImage?: string
  ) {
    // 1. Visual Auditing for Poor Quality Disputes (using Before and After Images)
    if (issueType === 'poor_quality' && (beforeImage || afterImage)) {
      console.log(`[DisputeAgent] Initiating visual quality dispute audit using Gemini 2.5 Flash...`);
      console.log(`- Before Image URL: ${beforeImage || 'None'}`);
      console.log(`- After Image URL: ${afterImage || 'None'}`);

      const systemInstruction = `
        You are the Expert Quality Auditor for Wasila.
        You are provided with two images of a service job:
        1. Image 1: The "Before" state (condition before repair started).
        2. Image 2: The "After" state (completed work).
        
        Compare both states based on the category ("${bookingData.category || 'AC Technician'}").
        Evaluate if the final state (After) is genuinely improved compared to the Before state, or if the final work has defects, leaks, messy wires, or sloppy finishing (confirming "Poor Quality").
        
        You MUST respond ONLY with a JSON object in this exact schema:
        {
          "isValid": boolean,          // Whether the customer's complaint of poor quality is approved (true if work is messy/faulty, false if work is good)
          "refundAmount": number,      // Price to refund (Rs. ${bookingData.price || 0} if isValid is true, 0 if false)
          "providerPenalty": number,   // Reliability score deduction percentage (use 10 if isValid is true, 0 if false)
          "verdictSummary": "string",  // A friendly explanation of your observation and visual analysis in Roman Urdu (English alphabet only, no Nastaliq/Arabic script, max 2 sentences)
          "action": "refund_full" | "reject"
        }
      `;

      const userPrompt = `
        Customer's Explanation of Issue: "${details}"
        Booking Agreed Price: Rs. ${bookingData.price || 0}
        
        Please compare the Before state (Image 1) and the After state (Image 2) and return the JSON evaluation.
      `;

      const imageUrls = [];
      if (beforeImage) imageUrls.push(beforeImage);
      if (afterImage) imageUrls.push(afterImage);

      try {
        const responseText = await callOpenRouterMultimodal(systemInstruction, userPrompt, imageUrls, { isJson: true });
        console.log(`[DisputeAgent] Multimodal LLM response:`, responseText);
        const match = responseText.match(/\{[\s\S]*\}/);
        const decision = JSON.parse(match ? match[0] : '{}');
        
        return {
          isValid: decision.isValid !== undefined ? decision.isValid : false,
          refundAmount: Number(decision.refundAmount) || 0,
          providerPenalty: Number(decision.providerPenalty) || 0,
          verdictSummary: decision.verdictSummary || "Images ka audit successfully complete ho chuka hai.",
          action: decision.action || (decision.isValid ? "refund_full" : "reject")
        };
      } catch (err: any) {
        console.error('[DisputeAgent] Multimodal analysis failed, falling back to text-based evaluation:', err.message);
      }
    }

    // 2. Text-Based Fallback/Standard Dispute Audit Prompt
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

      3. "poor_quality" (Text-only fallback when no images are uploaded):
         - Return action: "reject", isValid: false, refundAmount: 0, verdictSummary: "Quality issues check karne ke liye live verification images required hain. Baraye meherbani visual proofs upload karein."

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

