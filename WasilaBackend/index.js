const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Load Providers Data
const providersPath = path.join(__dirname, 'data', 'providers.json');
let providers = [];

try {
  const data = fs.readFileSync(providersPath, 'utf8');
  providers = JSON.parse(data);
  console.log('✅ Providers database loaded successfully.');
} catch (err) {
  console.error('❌ Error loading providers data:', err);
}

// Routes
app.get('/', (req, res) => {
  res.send('Wasila AI Backend is running!');
});

// Get all providers
app.get('/api/providers', (req, res) => {
  res.json(providers);
});

// Search and Filter API (Foundation for AI Tools)
app.get('/api/providers/search', (req, res) => {
  const { category, maxPrice, maxDistance, minRating } = req.query;
  
  let filtered = providers;

  if (category) {
    filtered = filtered.filter(p => p.category.toLowerCase().includes(category.toLowerCase()));
  }

  if (maxPrice) {
    filtered = filtered.filter(p => p.pricePerHour <= parseInt(maxPrice));
  }

  if (maxDistance) {
    filtered = filtered.filter(p => p.distanceKm <= parseFloat(maxDistance));
  }

  if (minRating) {
    filtered = filtered.filter(p => p.rating >= parseFloat(minRating));
  }

  res.json(filtered);
});

app.listen(PORT, () => {
  console.log(`🚀 Wasila Backend listening at http://localhost:${PORT}`);
});
