import { ParserAgent } from './src/agents/ParserAgent';
import dotenv from 'dotenv';

dotenv.config();

async function testParser() {
  const parser = new ParserAgent();

  const query1 = "1000 me krdo discount k saath please apny to 1500 me krdya";
  console.log(`Parsing Query 1: "${query1}"`);
  const res1 = await parser.parse(query1);
  console.log("Result 1:", JSON.stringify(res1, null, 2));

  const query2 = "Yr 900 krdo rate please";
  console.log(`\nParsing Query 2: "${query2}"`);
  const res2 = await parser.parse(query2);
  console.log("Result 2:", JSON.stringify(res2, null, 2));
}

testParser().catch(console.error);
