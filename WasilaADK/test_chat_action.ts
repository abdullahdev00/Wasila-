import { ParserAgent } from './src/agents/ParserAgent';
import dotenv from 'dotenv';

dotenv.config();

async function runTest() {
  const parser = new ParserAgent();

  const mockPlumberMatch = {
    id: 'UWqxeWpmwmsWm3Q9rHdq',
    name: 'Pluming Tab repairing ',
    providerName: 'Provide 1',
    rating: 4.5,
    category: 'Plumbing',
    pricePerHour: 1500,
    location: 'Lahore'
  };

  // Mock state
  let userMemory = {
    lastMatch: mockPlumberMatch as any,
    currentCategory: 'Plumbing',
    history: [] as any[]
  };

  const steps = [
    { message: "Hello", expectedAction: "chat" },
    { message: "book kr do", expectedAction: "book" }
  ];

  for (const step of steps) {
    console.log(`\n--- Processing message: "${step.message}" ---`);
    // Contextual message
    const historyText = userMemory.history.map((h: any) => `User: "${h.user}" | AI: "${h.ai}"`).join('\n');
    const contextualMessage = `
      [Recent Chat History]:
      ${historyText || 'No previous chat'}
      
      [Current User Message]: "${step.message}"
    `;

    const parsed = await parser.parse(contextualMessage);
    console.log("Parsed Intent:", parsed);

    // Let's simulate the matchmaking result
    let matchResult = null; // No matchmaking run for simple chat or direct booking

    // Resolve finalBestMatch based on our new logic:
    let finalBestMatch = null;
    if (matchResult) {
      finalBestMatch = matchResult.bestMatch || null;
    } else if (parsed.action === 'book') {
      finalBestMatch = userMemory.lastMatch || null;
    }

    console.log("Resolved finalBestMatch (returned to frontend):", finalBestMatch);

    // Update mock history
    userMemory.history.push({ user: step.message, ai: "Mock reply" });
  }
}

runTest().catch(console.error);
