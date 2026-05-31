import axios from 'axios';

async function testWaleedBooking() {
  const userId = 'test-user-lahore-' + Math.random().toString(36).substring(7);
  console.log(`=== Simulation: Booking Waleed's AC Cleaning in Lahore ===`);
  console.log(`User Session ID: ${userId}\n`);

  const API_URL = 'https://wasila-backend-546907715054.us-central1.run.app/api/chat';

  try {
    // Step 1: Search for Waleed's AC Cleaning service in Johar Town, Lahore
    const msg1 = "Mujhe Cleaning service chahye Lahore Johar town me";
    console.log(`[User]: "${msg1}"`);
    let res = await axios.post(API_URL, {
      message: msg1,
      userId,
      userName: "Mohammad Abdullah",
      location: "Johar town, Lahore"
    });

    console.log(`\n[Wasila AI Reply]:`);
    console.log(res.data.reply);
    console.log("\n[Traces]:");
    res.data.traces.forEach((t: string) => console.log(`  ${t}`));
    console.log(`\nBest Match Provider: ${res.data.bestMatch?.name} by ${res.data.bestMatch?.providerName}`);
    console.log(`Price per Hour: Rs. ${res.data.bestMatch?.pricePerHour}`);
    console.log(`--------------------------------------------------\n`);

    // Step 2: Ask for a discount (Negotiation)
    const msg2 = "450 rupee krdo please thora sa discount dedo";
    console.log(`[User]: "${msg2}"`);
    res = await axios.post(API_URL, {
      message: msg2,
      userId,
      userName: "Mohammad Abdullah",
      location: "Johar town, Lahore"
    });

    console.log(`\n[Wasila AI Reply]:`);
    console.log(res.data.reply);
    console.log("\n[Traces]:");
    res.data.traces.forEach((t: string) => console.log(`  ${t}`));
    console.log(`\nBest Match Provider: ${res.data.bestMatch?.name} by ${res.data.bestMatch?.providerName}`);
    console.log(`Negotiated Price: Rs. ${res.data.bestMatch?.pricePerHour}`);
    console.log(`--------------------------------------------------\n`);

    // Step 3: Confirm and Book the service
    const msg3 = "haan book krdo";
    console.log(`[User]: "${msg3}"`);
    res = await axios.post(API_URL, {
      message: msg3,
      userId,
      userName: "Mohammad Abdullah",
      location: "Johar town, Lahore"
    });

    console.log(`\n[Wasila AI Reply]:`);
    console.log(res.data.reply);
    console.log("\n[Traces]:");
    res.data.traces.forEach((t: string) => console.log(`  ${t}`));
    console.log(`\nBooking Confirmed: ${res.data.bookingConfirmed}`);
    console.log(`--------------------------------------------------\n`);

    console.log("✔ Waleed AC cleaning booking test completed successfully!");
  } catch (error: any) {
    console.error("Test failed with error:", error.response?.data || error.message);
  }
}

testWaleedBooking();
