import axios from 'axios';

async function testUserIdentityFlow() {
  const userId = '5AnoztQXp5S0Xp4uFNr9vhg7Tzp1'; // Muhammad Abdullah 
  console.log(`Starting identity and booking lookup test for User ID: ${userId}\n`);

  try {
    console.log("Step 1: Sending greeting...");
    const res1 = await axios.post('http://localhost:5000/api/chat', {
      message: "AoA, kaise ho?",
      userId,
      userName: "Muhammad Abdullah"
    });
    console.log("Step 1 Response (Greeting):");
    console.log("-----------------------------------------");
    console.log(res1.data.reply);
    console.log("-----------------------------------------\n");

    console.log("Step 2: Asking for bookings list...");
    const res2 = await axios.post('http://localhost:5000/api/chat', {
      message: "meri bookings check krna k konsi hain",
      userId,
      userName: "Muhammad Abdullah"
    });
    console.log("Step 2 Response (Bookings):");
    console.log("-----------------------------------------");
    console.log(res2.data.reply);
    console.log("-----------------------------------------");
  } catch (error: any) {
    console.error("Test failed with error:", error.response?.data || error.message);
  }
}

testUserIdentityFlow();
