import axios from 'axios';

async function testPlumberIslamabad() {
  const userId = 'test-user-isb-' + Math.random().toString(36).substring(7);
  console.log(`=== Simulation: Finding Plumber in Islamabad ===`);

  const API_URL = 'https://wasila-backend-546907715054.us-central1.run.app/api/chat';

  try {
    const msg = "Mujhe plumber chahiye Islamabad me";
    console.log(`[User]: "${msg}"`);
    let res = await axios.post(API_URL, {
      message: msg,
      userId,
      userName: "Mohammad Abdullah",
      location: "Lahore" // client default location is Lahore
    });

    console.log(`\n[Wasila AI Reply]:`);
    console.log(res.data.reply);
    console.log("\n[Traces]:");
    res.data.traces.forEach((t: string) => console.log(`  ${t}`));
    console.log(`\nBest Match Provider: ${res.data.bestMatch?.name} by ${res.data.bestMatch?.providerName} in ${res.data.bestMatch?.location}`);
  } catch (error: any) {
    console.error("Test failed with error:", error.response?.data || error.message);
  }
}

testPlumberIslamabad();
