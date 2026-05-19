import axios from 'axios';

async function testGreetingFlow() {
  const userId = '5AnoztQXp5S0Xp4uFNr9vhg7Tzp1'; // Muhammad Abdullah 
  console.log(`Starting multi-turn concierge test for User ID: ${userId}\n`);

  try {
    console.log("Step 1: Asking for bookings...");
    const res1 = await axios.post('http://localhost:5000/api/chat', {
      message: "meri bookings check krna k konsi hain",
      userId,
      userName: "Muhammad Abdullah"
    });
    console.log("Step 1 Response (Bookings should be listed):");
    console.log("-----------------------------------------");
    console.log(res1.data.reply);
    console.log("-----------------------------------------\n");

    console.log("Step 2: Sending simple greeting ('Hey')...");
    const res2 = await axios.post('http://localhost:5000/api/chat', {
      message: "Hey",
      userId,
      userName: "Muhammad Abdullah"
    });
    console.log("Step 2 Response (Should ONLY greet, NO bookings listed):");
    console.log("-----------------------------------------");
    console.log(res2.data.reply);
    console.log("-----------------------------------------");
  } catch (error: any) {
    console.error("Test failed with error:", error.response?.data || error.message);
  }
}

testGreetingFlow();
