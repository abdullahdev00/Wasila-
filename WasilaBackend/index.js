const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const orchestrator = require('./orchestrator');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const { fetchProvidersFromFirebase } = require('./firebase');

// Load Providers Data
let providers = [];

async function loadProviders() {
  try {
    providers = await fetchProvidersFromFirebase();
    console.log(`✅ Loaded ${providers.length} providers from Firebase successfully.`);
  } catch (err) {
    console.error('❌ Error loading providers from Firebase:', err);
  }
}

// Initial load
loadProviders();
// Refresh data every 5 minutes
setInterval(loadProviders, 5 * 60 * 1000);

// Routes
app.get('/', (req, res) => {
  res.send('Wasila AI Backend is running!');
});

// Get all providers
app.get('/api/providers', (req, res) => {
  res.json(providers);
});

// Get Booking History
app.get('/api/bookings', (req, res) => {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'data', 'bookings.json'), 'utf8');
    res.json(JSON.parse(data || '[]'));
  } catch (err) {
    res.json([]);
  }
});

// AI Chat Endpoint (Agentic Reasoning)
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const result = await orchestrator.processRequest(message);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
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
