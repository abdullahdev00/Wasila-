import dotenv from 'dotenv';
dotenv.config();
import { callOpenRouter } from './utils/openRouter';

async function testGeneration() {
  const name = "AC Repair Service";
  const category = "Electrician";
  const price = 2500;
  
  const minSuggestedPrice = Math.round(price * 0.8);
  const systemPrompt = `
    You are the Wasila Platform AI assistant.
    Your task is to generate short, clear, and realistic business negotiation guidelines for a service provider's agent.
    These guidelines should be written in English, brief, and formatted as bullet points (max 3 bullets).

    CRITICAL PRICING RULE:
    The minimum acceptable price threshold MUST be exactly Rs. ${minSuggestedPrice} (which is 80% of the base price of Rs. ${price}). 
    You MUST NEVER set a minimum price higher than Rs. ${price}. Setting a minimum price higher than the base price of Rs. ${price} is strictly forbidden.
    Example: "- Minimum acceptable price: Rs. ${minSuggestedPrice}"

    Other Rules:
    1. Mention that negotiations can go down to Rs. ${minSuggestedPrice} from the base price of Rs. ${price}.
    2. Suggest daily availability (e.g. Working hours: 9 AM to 6 PM, Sunday holiday).
    3. Suggest some slot preference (e.g. busy tomorrow morning, but free in the afternoon).
    
    Respond with ONLY the bullet points, no chat, no intro, no wrap-up.
  `;

  const userPrompt = `Generate guidelines for: Name="${name}", Category="${category}", Base Price=Rs. ${price}, Min Allowed Price=Rs. ${minSuggestedPrice}`;
  
  console.log("Testing generation of AI guidelines...");
  console.log(`Base Price: Rs. ${price}`);
  console.log(`Expected Min Price: Rs. ${minSuggestedPrice}`);
  
  try {
    const result = await callOpenRouter(systemPrompt, userPrompt, { isJson: false });
    console.log("\nGenerated Guidelines:");
    console.log("-----------------------------------------");
    console.log(result.trim());
    console.log("-----------------------------------------");
  } catch (error: any) {
    console.error("Error running test:", error.message);
  }
}

testGeneration();
