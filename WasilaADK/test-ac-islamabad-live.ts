import axios from 'axios';

async function testACIslamabadLive() {
  const userId = 'test-user-live-nomatch-' + Date.now();
  console.log(`=== Integration Test: Finding AC Technician in Islamabad (Live Cloud Run) ===`);

  const API_URL = 'https://wasila-backend-546907715054.us-central1.run.app/api/chat';

  try {
    const msg = "Yr ac khraab hogya ha ghr ka";
    console.log(`[User]: "${msg}"`);
    let res = await axios.post(API_URL, {
      message: msg,
      userId,
      userName: "Mohammad Abdullah",
      location: "Islamabad Faizabad"
    });

    console.log(`\n[Wasila AI Live Reply]:`);
    console.log(res.data.reply);
    console.log("\n[Booking Status]:", res.data.bookingStatus);
    console.log("\n[Traces]:");
    res.data.traces.forEach((t: any) => console.log(`  ${t}`));
  } catch (error: any) {
    console.error("Test failed with error:", error.response?.data || error.message);
  }
}

testACIslamabadLive();
