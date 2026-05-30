import { ParserAgent } from './src/agents/ParserAgent';
import { MatchmakerAgent } from './src/agents/MatchmakerAgent';
import dotenv from 'dotenv';

dotenv.config();

async function runTest() {
  const parser = new ParserAgent();
  const matchmaker = new MatchmakerAgent();

  const query = "electrician chahye";
  console.log(`Testing query: "${query}"`);

  const parsed = await parser.parse(query);
  console.log("Parsed result:", parsed);

  if (parsed.category) {
    const match = await matchmaker.findMatch(query, parsed.category, "Lahore");
    console.log("Matchmaker result:", JSON.stringify(match, null, 2));
  } else {
    console.log("No category parsed!");
  }
}

runTest().catch(console.error);
