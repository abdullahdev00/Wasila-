import { MatchmakerAgent } from './src/agents/MatchmakerAgent';
import { fetchProvidersFromFirebase } from './src/firebase';
import dotenv from 'dotenv';

dotenv.config();

async function testMatchmaker() {
  console.log("=== Debugging Matchmaker for Waleed in Lahore ===\n");

  const allProviders = await fetchProvidersFromFirebase();
  console.log(`Total providers in DB: ${allProviders.length}`);
  allProviders.forEach(p => {
    console.log(`- Provider: ${p.name} (${p.serviceName}), Category: ${p.category}, City/Location: ${p.location}`);
  });

  const query = "Mujhe AC deep cleaning chahye Lahore Johar town me";
  const category = "AC Technician"; // what ParserAgent returns
  const resolvedLocation = "Johar town, Lahore";

  console.log(`\nTesting with Query: "${query}", Category: "${category}", Location: "${resolvedLocation}"`);

  console.log(`\nTesting with Query: "${query}", Category: "${category}", Location: "${resolvedLocation}"`);

  const agent = new MatchmakerAgent();
  const result = await agent.findMatch(query, category, resolvedLocation);

  console.log(`\nMatchmaker Output:`);
  console.log(JSON.stringify(result, null, 2));
}

testMatchmaker().catch(console.error);
