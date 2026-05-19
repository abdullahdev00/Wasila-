import axios from 'axios';

async function testBookingFlow() {
  const userId = 'test-user-' + Math.random().toString(36).substring(7);
  console.log(`Starting booking test for session: ${userId}\n`);

  try {
    console.log("Step 1: Asking for a plumber...");
    const res1 = await axios.post('http://localhost:5000/api/chat', {
      message: "Mujhe sink theek karwane ke liye plumber chahye",
      userId
    });
    console.log("Step 1 Response:", res1.data.reply);
    console.log("Traces:", res1.data.traces);
    console.log("Best Match:", res1.data.bestMatch?.name || "None");
    
    if (!res1.data.bestMatch) {
      console.error("No provider matched! Cannot proceed to booking.");
      return;
    }

    console.log("\nStep 2: Confirming booking...");
    const res2 = await axios.post('http://localhost:5000/api/chat', {
      message: "Book krdo",
      userId
    });
    console.log("Step 2 Response:", res2.data.reply);
    console.log("Traces:", res2.data.traces);
  } catch (error: any) {
    console.error("Test failed with error:", error.response?.data || error.message);
  }
}

testBookingFlow();
