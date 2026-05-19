import axios from 'axios';

async function testAgentNegotiation() {
  const userId = '5AnoztQXp5S0Xp4uFNr9vhg7Tzp1'; // Muhammad Abdullah
  console.log("Starting Agent-to-Agent Negotiation Integration Test...\n");

  try {
    console.log("Sending search request: Plumber service in G-11 tomorrow at 11:00 AM...");
    const res = await axios.post('http://localhost:5000/api/chat', {
      message: "Mjy Plumber chahiya G-11 Kal 11 bjy din ky",
      userId,
      userName: "Muhammad Abdullah"
    });

    console.log("\n--- API Response Reply ---");
    console.log(res.data.reply);

    console.log("\n--- Execution Traces (Agent Conversation) ---");
    res.data.traces.forEach((trace: string) => {
      console.log(trace);
    });

    console.log("\n--- Final Best Match Negotiated Details ---");
    console.log(`Negotiated Price: Rs. ${res.data.bestMatch?.pricePerHour}`);
    console.log(`Negotiated Time: ${res.data.bestMatch?.negotiatedDateTime}`);
    console.log(`Negotiated Status: ${res.data.bestMatch?.negotiatedStatus}`);
    console.log("-------------------------------------------");

  } catch (error: any) {
    console.error("Test failed with error:", error.response?.data || error.message);
  }
}

testAgentNegotiation();
