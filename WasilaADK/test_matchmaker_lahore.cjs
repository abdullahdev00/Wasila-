require('ts-node/register');
const { MatchmakerAgent } = require('./src/agents/MatchmakerAgent.ts');

async function test() {
  const agent = new MatchmakerAgent();
  const res = await agent.findMatch('Lahore me hai koi?', 'Ac technician', 'Lahore');
  console.log(JSON.stringify(res, null, 2));
}

test();
