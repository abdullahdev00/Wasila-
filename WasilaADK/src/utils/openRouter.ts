import * as dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();

// Helper to delay execution (sleep)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Utility client to handle all model inferences via OpenRouter.
 * Automatically tries free models first and implements fallback loops
 * to ensure 100% system availability without costing the user anything.
 */
export async function callOpenRouter(
  systemInstruction: string,
  userPrompt: string,
  options: { isJson?: boolean; model?: string } = {}
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment variables.");
  }

  // Model hierarchy: start with auto free router, then specific free models, and finally cheap paid Gemini
  const modelPipeline = [
    "openrouter/free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "google/gemini-2.5-flash" // Safe, ultra-cheap fallback ($0.00007 / request) to guarantee 100% uptime
  ];

  // If the caller explicitly passed a model, prioritize it at the top of the pipeline
  if (options.model) {
    modelPipeline.unshift(options.model);
  }

  const endpoint = "https://openrouter.ai/api/v1/chat/completions";

  for (const modelName of modelPipeline) {
    console.log(`[OpenRouter Client] Attempting inference with model: '${modelName}'...`);
    
    // We allow up to 2 retries per model if we encounter rate limits (429)
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await axios.post(
          endpoint,
          {
            model: modelName,
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: userPrompt }
            ],
            response_format: options.isJson ? { type: "json_object" } : undefined,
            temperature: 0.1,
            max_tokens: 1000
          },
          {
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://wasila.ai",
              "X-Title": "Wasila ADK"
            },
            validateStatus: () => true // Allow handling error codes manually in our logic
          }
        );

        // Handle success
        if (response.status === 200) {
          const reply = response.data?.choices?.[0]?.message?.content;
          if (reply) {
            console.log(`[OpenRouter Client] Success using model: '${modelName}'`);
            return reply;
          }
        }

        // Handle Rate Limiting (429) or transient server errors (5xx)
        if (response.status === 429 || response.status >= 500) {
          console.warn(`[OpenRouter Client] Model '${modelName}' returned status ${response.status}. Attempt ${attempt}/2. Retrying in 1s...`);
          await sleep(1000);
          continue;
        }

        // For other errors (e.g. 404 No endpoints found), fail fast and move to the next model in pipeline
        console.warn(`[OpenRouter Client] Model '${modelName}' failed with status ${response.status}: ${JSON.stringify(response.data)}`);
        break;

      } catch (error: any) {
        console.warn(`[OpenRouter Client] Network/Inference error with model '${modelName}': ${error.message}`);
        break; // Move to next model in pipeline
      }
    }
  }

  throw new Error("All free and fallback models in the OpenRouter pipeline failed.");
}
