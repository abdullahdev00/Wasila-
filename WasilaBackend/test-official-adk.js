const { LlmAgent } = require('@google/adk');
require('dotenv').config();

async function testADK() {
  try {
    const agent = new LlmAgent({
      name: 'wasila_test',
      description: 'Test agent for Wasila',
      model: 'gemini-1.5-flash',
      instruction: 'Say "ADK is working!"'
    });
    console.log("ADK Agent created successfully");
  } catch (e) {
    console.error("ADK Load Error:", e.message);
  }
}

testADK();
