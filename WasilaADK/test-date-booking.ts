import axios from 'axios';

async function testDateBookingFlow() {
  const userId = 'test-user-date-' + Math.random().toString(36).substring(7);
  console.log(`Starting date booking test for session: ${userId}\n`);

  try {
    console.log("Step 1: Asking for a plumber...");
    const res1 = await axios.post('http://localhost:5000/api/chat', {
      message: "Mujhe sink repairing ke liye plumber chahye",
      userId
    });
    console.log("Step 1 Response:", res1.data.reply);
    
    if (!res1.data.bestMatch) {
      console.error("No provider matched! Cannot proceed to booking.");
      return;
    }

    console.log("\nStep 2: Confirming booking for 3:00 PM tomorrow...");
    const res2 = await axios.post('http://localhost:5000/api/chat', {
      message: "kal dopahar 3 baje book krdo",
      userId
    });
    console.log("Step 2 Response:", res2.data.reply);
  } catch (error: any) {
    console.error("Test failed with error:", error.response?.data || error.message);
  }
}

testDateBookingFlow();
