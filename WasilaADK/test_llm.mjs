import { callOpenRouter } from './src/utils/openRouter.js';

async function test() {
  const filteredProviders = [
    {
      id: "UWqxeWpmwmsWm3Q9rHdq",
      name: "Pluming Tab repairing ",
      category: "Plumbing",
      price: 1500,
      description: "We provide a plumber for your work ",
      isActive: true,
      providerName: "Provide 1",
      city: "Lahore"
    }
  ];
  const query = "G hn lahore";
  const cleanedCategory = "Plumber";
  
  const instruction = \
    You are the Matchmaker for Wasila.
    Rank the provided candidates based on their rating, relevance to the user need, and status.
    Extract the candidate's serviceName as "name", and the candidate's "name" as "providerName".
    Return ONLY a JSON object: {"bestMatch": {"id": "string", "name": "string", "providerName": "string", "rating": number, "category": "string", "pricePerHour": number, "location": "string"}, "reasoning": "explanation"}
  \;
  const promptText = \
    User Need: "\"
    Category Needed: "\"
    Candidates Found in Database:
    \
  \;
  
  const res = await callOpenRouter(instruction, promptText, { isJson: true });
  console.log('LLM Match:', res);
}
test().catch(console.error);
