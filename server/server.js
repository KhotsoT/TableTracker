const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin SDK
let serviceAccount;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.log('Using Firebase service account from environment variable');
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is required in production');
  } else {
    console.log('Using local serviceAccountKey.json');
    serviceAccount = require('./serviceAccountKey.json');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Admin:', error);
  process.exit(1);
}

const app = express();
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://schoolconnect-curtis.web.app',
    'https://schoolconnect-server.onrender.com'
  ],
  methods: ['GET', 'POST'],
  credentials: true
}));
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

// Update the sent-messages endpoint with better pagination and logging
app.get('/api/sent-messages', async (req, res) => {
  try {
    let allMessages = [];
    let currentPage = 1;
    let hasMoreMessages = true;
    
    console.log('Starting to fetch messages...');

    // Fetch messages until we get an empty page
    while (hasMoreMessages) {
      console.log(`Fetching page ${currentPage}...`);
      
      const response = await fetch(`https://www.zoomconnect.com/app/api/rest/v1/messages/all?type=OUTBOUND&page=${currentPage}&pageSize=100`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'email': process.env.ZOOM_CONNECT_EMAIL,
          'token': process.env.ZOOM_CONNECT_KEY
        }
      });

      const responseText = await response.text();
      console.log(`Page ${currentPage} response:`, responseText.substring(0, 200) + '...'); // Log first 200 chars

      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}: ${responseText}`);
      }

      const data = JSON.parse(responseText);
      const messages = data.webServiceMessages || [];
      
      console.log(`Found ${messages.length} messages on page ${currentPage}`);
      
      if (messages.length === 0) {
        hasMoreMessages = false;
        console.log('No more messages found');
      } else {
        allMessages = [...allMessages, ...messages];
        currentPage++;
      }

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`Total messages fetched: ${allMessages.length}`);

    // Group messages by content and time (within same minute)
    const groupedMessages = allMessages.reduce((groups, msg) => {
      const messageTime = new Date(msg.dateTimeSent).getTime();
      const key = `${msg.message}_${Math.floor(messageTime / 60000)}`;

      if (!groups[key]) {
        groups[key] = {
          id: msg.messageId,
          message: msg.message,
          sentAt: msg.dateTimeSent,
          recipients: [],
          totalRecipients: 0,
          totalCredits: 0,
          status: {
            delivered: 0,
            failed: 0,
            pending: 0
          }
        };
      }

      groups[key].recipients.push({
        number: msg.toNumber,
        status: msg.messageStatus?.toLowerCase() || 'pending',
        credits: msg.creditCost || 1
      });

      groups[key].totalRecipients++;
      groups[key].totalCredits += (msg.creditCost || 1);
      groups[key].status[msg.messageStatus?.toLowerCase() || 'pending']++;

      return groups;
    }, {});

    const messages = Object.values(groupedMessages)
      .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

    console.log(`Grouped into ${messages.length} unique messages`);

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

// Add new endpoint to handle resending failed messages
app.post('/api/resend-message', async (req, res) => {
  try {
    const { message, recipients } = req.body;
    
    // Send messages one at a time as per API requirements
    const results = [];
    for (const recipientNumber of recipients) {
      const response = await fetch('https://www.zoomconnect.com/app/api/rest/v1/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'email': process.env.ZOOM_CONNECT_EMAIL,
          'token': process.env.ZOOM_CONNECT_KEY
        },
        body: JSON.stringify({
          recipientNumber,
          message
        })
      });

      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(`Failed to send SMS: ${response.status} - ${responseText}`);
      }

      try {
        const result = JSON.parse(responseText);
        results.push(result);
      } catch (e) {
        results.push({ status: 'sent', raw: responseText });
      }

      // Add small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    res.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('Error resending messages:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add endpoint to handle sending messages
app.post('/api/send-message', async (req, res) => {
  try {
    const { message, recipients } = req.body;
    
    // Send messages one at a time
    const results = [];
    for (const recipientNumber of recipients) {
      const response = await fetch('https://www.zoomconnect.com/app/api/rest/v1/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'email': process.env.ZOOM_CONNECT_EMAIL,
          'token': process.env.ZOOM_CONNECT_KEY
        },
        body: JSON.stringify({
          recipientNumber,
          message
        })
      });

      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(`Failed to send SMS: ${response.status} - ${responseText}`);
      }

      try {
        const result = JSON.parse(responseText);
        results.push(result);
      } catch (e) {
        results.push({ status: 'sent', raw: responseText });
      }

      // Add small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    res.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add endpoint to fetch inbox messages
app.get('/api/inbox-messages', async (req, res) => {
  try {
    let allMessages = [];
    let currentPage = 1;
    let hasMoreMessages = true;
    
    console.log('Starting to fetch inbox messages...');

    // Fetch messages until we get an empty page
    while (hasMoreMessages) {
      console.log(`Fetching inbox page ${currentPage}...`);
      
      const response = await fetch(`https://www.zoomconnect.com/app/api/rest/v1/messages/all?type=INBOUND&page=${currentPage}&pageSize=100`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'email': process.env.ZOOM_CONNECT_EMAIL,
          'token': process.env.ZOOM_CONNECT_KEY
        }
      });

      const responseText = await response.text();
      console.log(`Page ${currentPage} response:`, responseText.substring(0, 200) + '...'); 

      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}: ${responseText}`);
      }

      const data = JSON.parse(responseText);
      const messages = data.webServiceMessages || [];
      
      console.log(`Found ${messages.length} inbox messages on page ${currentPage}`);
      
      if (messages.length === 0) {
        hasMoreMessages = false;
        console.log('No more inbox messages found');
      } else {
        allMessages = [...allMessages, ...messages];
        currentPage++;
      }

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`Total inbox messages fetched: ${allMessages.length}`);

    // Format messages for the frontend
    const formattedMessages = allMessages.map(msg => ({
      messageId: msg.messageId,
      message: msg.message,
      dateTimeReceived: msg.dateTimeReceived,
      fromNumber: msg.fromNumber,
      messageStatus: msg.messageStatus || 'received',
      creditCost: msg.creditCost || 0
    }));

    res.json({
      success: true,
      messages: formattedMessages
    });

  } catch (error) {
    console.error('Error fetching inbox messages:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 10000;
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