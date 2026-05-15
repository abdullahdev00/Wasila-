const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Mock Data for Service Providers
const providers = [
  {
    id: 1,
    name: "Ahmed Raza",
    category: "Plumber",
    rating: 4.8,
    price: "1500 PKR",
    distance: "2.5 km",
    verified: true,
    location: "G-11, Islamabad"
  },
  {
    id: 2,
    name: "Sajid Khan",
    category: "Electrician",
    rating: 4.5,
    price: "1200 PKR",
    distance: "1.2 km",
    verified: true,
    location: "F-10, Islamabad"
  },
  {
    id: 3,
    name: "Zeeshan Ali",
    category: "Maths Tutor",
    rating: 4.9,
    price: "3000 PKR/hr",
    distance: "4.0 km",
    verified: false,
    location: "I-8, Islamabad"
  }
];

// Routes
app.get('/', (req, res) => {
  res.send('Wasila Backend is running!');
});

app.get('/api/providers', (req, res) => {
  res.json(providers);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
