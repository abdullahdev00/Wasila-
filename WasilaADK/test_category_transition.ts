import { ParserAgent } from './src/agents/ParserAgent';
import { MatchmakerAgent } from './src/agents/MatchmakerAgent';
import dotenv from 'dotenv';

dotenv.config();

async function runTest() {
  const parser = new ParserAgent();
  const matchmaker = new MatchmakerAgent();

  // Simulated session memory
  let userMemory = {
    currentCategory: null as string | null,
    lastProviderId: null as string | null,
    lastMatch: null as any | null,
  };

  const steps = [
    { message: "plumber chahye lahore me", location: "Lahore" },
    { message: "electrician chahye quetta me", location: "Quetta" }
  ];

  for (const step of steps) {
    console.log(`\n--- Processing message: "${step.message}" ---`);
    const parsed = await parser.parse(step.message);
    console.log("Parsed Intent:", parsed);

    // Mimic the server category change detection
    if (parsed.category) {
      if (!userMemory.currentCategory || userMemory.currentCategory !== parsed.category) {
        console.log(`[Session Switch] Category changed from ${userMemory.currentCategory} to ${parsed.category}.`);
        userMemory.currentCategory = parsed.category;
        userMemory.lastProviderId = null;
        userMemory.lastMatch = null;
      }
    }

    let matchResult = null;
    if (parsed.category) {
      matchResult = await matchmaker.findMatch(step.message, parsed.category, step.location);
    }

    console.log("Matchmaker found bestMatch:", matchResult?.bestMatch);

    // Resolve finalBestMatch exactly as server.ts does:
    const finalBestMatch = matchResult?.bestMatch || userMemory.lastMatch || null;
    console.log("Resolved finalBestMatch (returned to frontend):", finalBestMatch);

    // Save the match details for next turn
    if (matchResult?.bestMatch) {
      userMemory.lastProviderId = matchResult.bestMatch.id;
      userMemory.lastMatch = matchResult.bestMatch;
    }
  }
}

runTest().catch(console.error);
