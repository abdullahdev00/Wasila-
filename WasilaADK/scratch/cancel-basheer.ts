import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function cancelBasheer() {
  const PORT = process.env.PORT || 5000;
  const bookingId = "59b2IQMxcKbzSLYiH8wj";
  const url = `http://localhost:${PORT}/api/bookings/${bookingId}/provider-cancel`;
  
  console.log(`=== Cancelling Basheer's Booking (ID: ${bookingId}) ===`);
  console.log(`Sending POST request to cancel endpoint: ${url}`);
  
  try {
    const res = await axios.post(url);
    console.log("Cancellation response from server:", res.data);
    console.log("\n✔ Proactive Recovery for Basheer successfully triggered!");
  } catch (error: any) {
    console.error("Error calling cancel API:", error.response?.data || error.message);
  }
}

cancelBasheer().catch(console.error);
