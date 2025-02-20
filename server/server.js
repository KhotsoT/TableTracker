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

// Update the get-messages endpoint to use the correct URL for inbox messages
app.get('/api/get-messages', async (req, res) => {
  try {
    console.log('Fetching messages from Zoom Connect...');
    
    const params = new URLSearchParams({
      type: 'INBOUND',
      page: '1'
    });
    
    const response = await fetch(`https://www.zoomconnect.com/app/api/rest/v1/messages/all?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'email': process.env.ZOOM_CONNECT_EMAIL,
        'token': process.env.ZOOM_CONNECT_KEY
      }
    });

    const responseText = await response.text();
    console.log('Messages API Response:', {
      status: response.status,
      body: responseText
    });

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}: ${responseText}`);
    }

    const data = JSON.parse(responseText);
    
    // Transform the response to match our frontend expectations
    const messages = (data.webServiceMessages || []).map(msg => ({
      messageId: msg.messageId,
      sender: msg.fromNumber,
      message: msg.message,
      receivedAt: msg.dateTimeReceived,
      status: msg.messageStatus?.toLowerCase() || 'received'
    }));

    res.json({
      success: true,
      messages
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update the balance endpoint to properly parse and return the credit balance
app.get('/api/balance', async (req, res) => {
  try {
    const response = await fetch('https://www.zoomconnect.com/app/api/rest/v1/account/balance', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'email': process.env.ZOOM_CONNECT_EMAIL,
        'token': process.env.ZOOM_CONNECT_KEY
      }
    });

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
      balance: data.creditBalance
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add sent messages endpoint
app.get('/api/sent-messages', async (req, res) => {
  try {
    const params = new URLSearchParams({
      type: 'OUTBOUND',
      page: '1'
    });
    
    const response = await fetch(`https://www.zoomconnect.com/app/api/rest/v1/messages/all?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'email': process.env.ZOOM_CONNECT_EMAIL,
        'token': process.env.ZOOM_CONNECT_KEY
      }
    });

    const responseText = await response.text();
    console.log('Sent Messages API Response:', {
      status: response.status,
      body: responseText
    });

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}: ${responseText}`);
    }

    const data = JSON.parse(responseText);
    
    // Transform the response to match our frontend expectations
    const messages = (data.webServiceMessages || []).map(msg => ({
      id: msg.messageId,
      recipient: msg.toNumber,
      message: msg.message,
      sentAt: msg.dateTimeSent,
      status: msg.messageStatus?.toLowerCase() || 'sent',
      credits: msg.creditCost || 1
    }));

    res.json({
      success: true,
      messages
    });
  } catch (error) {
    console.error('Error fetching sent messages:', error);
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