const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const API_URL = process.env.ZOOM_CONNECT_API;
const API_KEY = process.env.ZOOM_CONNECT_KEY;
const API_EMAIL = process.env.ZOOM_CONNECT_EMAIL;

// Log server configuration on startup
console.log('Server starting with config:', {
  apiUrl: API_URL,
  hasApiKey: !!API_KEY,
  hasEmail: !!API_EMAIL
});

app.post('/api/send-sms', async (req, res) => {
  try {
    const response = await fetch(`${API_URL}/sms/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'email': API_EMAIL,
        'token': API_KEY
      },
      body: JSON.stringify(req.body)
    });
    
    if (!response.ok) {
      console.error('SMS send error:', await response.text());
      throw new Error(`API responded with status ${response.status}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('SMS send error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/balance', async (req, res) => {
  try {
    const response = await fetch(`${API_URL}/balance`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'email': API_EMAIL,
        'token': API_KEY
      }
    });
    
    console.log('Balance request headers:', {
      email: API_EMAIL,
      token: API_KEY && API_KEY.substring(0, 8) + '...'
    });
    
    if (!response.ok) {
      console.error('Balance API error:', await response.text());
      throw new Error(`API responded with status ${response.status}`);
    }
    
    const data = await response.json();
    console.log('SMS balance response:', data);
    res.json(data);
  } catch (error) {
    console.error('SMS balance error:', error);
    res.status(500).json({ error: 'Failed to fetch SMS balance' });
  }
});

app.listen(3000, () => {
  console.log('Proxy server running on port 3000');
  console.log('API URL:', API_URL);
}); 