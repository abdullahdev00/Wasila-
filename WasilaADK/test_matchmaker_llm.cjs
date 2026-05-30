require('ts-node/register');
const { MatchmakerAgent } = require('./src/agents/MatchmakerAgent.ts');

async function test() {
  const agent = new MatchmakerAgent();
  const res = await agent.findMatch('G hn lahore', 'Plumber', 'Lahore');
  console.log('Result:', JSON.stringify(res, null, 2));
}
test().catch(console.error);
