import { InMemoryRunner } from '@google/adk';

/**
 * Executes runEphemeral on an InMemoryRunner with automatic exponential backoff retry
 * specifically for 429 Rate Limit / Quota Exceeded errors.
 * Dynamically parses the exact cooling period required by the Gemini API to avoid wasting retries.
 */
export async function runEphemeralWithRetry(
  runner: InMemoryRunner,
  options: {
    userId: string;
    newMessage: { role: string; parts: { text: string }[] };
  },
  maxRetries = 5,
  initialDelayMs = 2000
): Promise<string> {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      let resultText = "";
      const events = runner.runEphemeral(options);

      for await (const event of events) {
        if (event.errorCode) {
          // If the event indicates a rate limit or other error, throw it so the catch block handles it
          throw new Error(`API Error ${event.errorCode}: ${event.errorMessage}`);
        }
        if (event.content && event.content.parts && event.author !== 'user') {
          resultText += event.content.parts[0]?.text || "";
        }
      }
      return resultText;
    } catch (error: any) {
      attempt++;
      const errorMessage = error.message || "";
      const isRateLimit = 
        errorMessage.includes('429') || 
        errorMessage.toLowerCase().includes('quota') || 
        errorMessage.toLowerCase().includes('limit');
        
      if (isRateLimit && attempt < maxRetries) {
        // Try to parse the exact cooling time from the Gemini API error
        const match = errorMessage.match(/Please retry in ([\d\.]+)s/i);
        let delay = initialDelayMs * Math.pow(2, attempt - 1);
        
        if (match && match[1]) {
          const seconds = parseFloat(match[1]);
          delay = Math.ceil(seconds * 1000) + 1500; // Wait exact time + buffer
          
          if (delay > 5000) {
             console.warn(`⏳ [Rate Limit] Wait time is too long (${delay}ms). Failing fast to prevent UI freeze.`);
             throw new Error("Quota exceeded. Please try again later.");
          }
          
          console.warn(`⚠️ [Rate Limit 429] Detected cooling period. Waiting ${delay}ms before retrying... (Attempt ${attempt}/${maxRetries})`);
        } else {
          console.warn(`⚠️ [Rate Limit 429] Retrying agent run in ${delay}ms... (Attempt ${attempt}/${maxRetries})`);
        }
        
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(`❌ [Agent Run Error] Permanent failure or max retries reached:`, errorMessage);
        throw error;
      }
    }
  }
  
  throw new Error("Max retries exceeded for Gemini API");
}
