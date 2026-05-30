import { MatchmakerAgent } from './src/agents/MatchmakerAgent.js';
import { fetchProvidersFromFirebase } from './src/firebase.js';

async function run() {
  const providers = await fetchProvidersFromFirebase();
  console.log("Providers in DB:", providers.map(p => ({ id: p.id, cat: p.category, name: p.serviceName })));
  
  const m = new MatchmakerAgent();
  const res = await m.findMatch("Lahore g3", "Plumber", "Lahore");
  console.log("Match Result:", res);
}
run().catch(console.error);
