import axios from 'axios';

async function testACIslamabad() {
  const userId = 'test-user-nomatch-' + Date.now();
  console.log(`=== Integration Test: Finding AC Technician in Islamabad (Local) ===`);

  const API_URL = 'http://localhost:5000/api/chat';

  try {
    const msg = "Yr ac khraab hogya ha ghr ka";
    console.log(`[User]: "${msg}"`);
    let res = await axios.post(API_URL, {
      message: msg,
      userId,
      userName: "Mohammad Abdullah",
      location: "Islamabad Faizabad" // User is in Islamabad
    });

    console.log(`\n[Wasila AI Reply]:`);
    console.log(res.data.reply);
    console.log("\n[Booking Status]:", res.data.bookingStatus);
    console.log("\n[Traces]:");
    res.data.traces.forEach((t: any) => console.log(`  Agent: ${t.agent} | Status: ${t.status} | Detail: ${t.detail}`));
    console.log(`\nBest Match Provider:`, res.data.bestMatch);
  } catch (error: any) {
    console.error("Test failed with error:", error.response?.data || error.message);
  }
}

testACIslamabad();
