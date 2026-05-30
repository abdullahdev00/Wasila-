import { callOpenRouter } from './src/utils/openRouter.js';

async function test() {
  const filteredProviders = [
    {
      id: "UWqxeWpmwmsWm3Q9rHdq",
      name: "Ali Trader",
      category: "Repair",
      rating: 5,
      pricePerHour: 2000,
      location: "Islamabad"
    }
  ];
  
  const resolvedLocation = "Lahore";
  const query = "Lahore me hai koi?";
  const cleanedCategory = "Ac technician";

  const instruction = \
        You are the Matchmaker for Wasila.
        Rank the provided candidates based on their rating, relevance to the user need, and status.
        IMPORTANT: The user's target location is "\". If a candidate has this city/location (or if their city is empty/missing), consider it a valid match! Do NOT reject a candidate just because their city is empty.
        Extract the candidate's service title (name or serviceName) as "name", and the candidate's person name (providerName or name) as "providerName".
        Return ONLY a JSON object: {"bestMatch": {"id": "string", "name": "string", "providerName": "string", "rating": number, "category": "string", "pricePerHour": number, "location": "string"}, "reasoning": "explanation"}
  \;

  const promptText = \
        User Need: "\"
        Category Needed: "\"
        Target Location: "\"
        Candidates Found in Database:
        \
  \;

  const res = await callOpenRouter(instruction, promptText, { isJson: true });
  console.log(res);
}

test();
