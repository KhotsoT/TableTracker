const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Validate environment variables
const requiredEnvVars = ['ZOOM_CONNECT_KEY', 'ZOOM_CONNECT_EMAIL'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

app.post('/api/send-sms', async (req, res) => {
  try {
    const { messages } = req.body;
    console.log('Processing SMS requests for', messages.length, 'recipients');

    const results = [];
    
    // Send messages one at a time as per API example
    for (const msg of messages) {
      const requestBody = {
        recipientNumber: msg.recipientNumber,
        message: msg.message
      };

      console.log('Sending SMS to:', requestBody.recipientNumber);

      const response = await fetch('https://www.zoomconnect.com/app/api/rest/v1/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'email': process.env.ZOOM_CONNECT_EMAIL,
          'token': process.env.ZOOM_CONNECT_KEY
        },
        body: JSON.stringify(requestBody)
      });

      const responseText = await response.text();
      console.log('API Response:', {
        status: response.status,
        body: responseText
      });

      if (!response.ok) {
        throw new Error(`Failed to send SMS: ${response.status} - ${responseText}`);
      }

      try {
        const result = JSON.parse(responseText);
        results.push(result);
      } catch (e) {
        console.log('Non-JSON response:', responseText);
        results.push({ status: 'sent', raw: responseText });
      }
    }

    res.json({
      success: true,
      data: {
        results,
        totalSent: messages.length
      }
    });

  } catch (error) {
    console.error('Error sending SMS:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    zoomConnect: {
      hasKey: !!process.env.ZOOM_CONNECT_KEY,
      hasEmail: !!process.env.ZOOM_CONNECT_EMAIL
    }
  });
});

// Update the get-messages endpoint with the correct URL
app.get('/api/get-messages', async (req, res) => {
  try {
    console.log('Fetching messages from Zoom Connect...');
    
    const response = await fetch('https://www.zoomconnect.com/app/api/rest/v1/sms/received/', {  // Added trailing slash
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'email': process.env.ZOOM_CONNECT_EMAIL,
        'token': process.env.ZOOM_CONNECT_KEY
      }
    });

    const responseText = await response.text();
    console.log('Zoom Connect Response:', {
      status: response.status,
      body: responseText
    });

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}: ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse JSON response:', responseText);
      throw new Error('Invalid JSON response from API');
    }

    console.log('Parsed response data:', data);
    
    res.json({
      success: true,
      messages: data.messages || [] // Expect messages array in response
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add the balance endpoint
app.get('/api/balance', async (req, res) => {
  try {
    // Build URL with query parameters
    const params = new URLSearchParams({
      email: process.env.ZOOM_CONNECT_EMAIL,
      token: process.env.ZOOM_CONNECT_KEY
    });
    
    const url = `https://www.zoomconnect.com/app/api/rest/v1/account/balance?${params}`;
    console.log('Fetching balance from:', url.replace(process.env.ZOOM_CONNECT_KEY, '***'));

    const response = await fetch(url);
    const responseText = await response.text();
    
    console.log('Balance API Response:', {
      status: response.status,
      body: responseText
    });

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}: ${responseText}`);
    }

    const data = JSON.parse(responseText);
    
    res.json({
      success: true,
      balance: data.creditBalance || 0
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Using API key:', process.env.ZOOM_CONNECT_KEY?.substring(0, 8) + '...');
});

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
}); 