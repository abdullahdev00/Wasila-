import axios from 'axios';

async function testApi() {
  console.log("Sending POST request to /api/chat...");
  try {
    const res = await axios.post('http://localhost:5000/api/chat', {
      message: "Mujhe sink theek karwane ke liye plumber chahye"
    });
    console.log("\nAPI Response:");
    console.log(JSON.stringify(res.data, null, 2));
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

testApi();
