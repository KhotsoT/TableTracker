import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
// import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';
import axios from 'axios';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from server/.env
dotenv.config({ path: join(__dirname, '.env') });

// Initialize Firebase Admin SDK
/*
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
*/

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

// Cache variables for inbox messages
let inboxMessagesCache = [];
let isUpdatingInboxCache = false;
let lastInboxUpdate = null;

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

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid messages provided'
      });
    }

    // Validate all messages before sending
    const validMessages = messages.filter(msg => {
      if (!msg.recipientNumber || !msg.message) {
        console.warn('Invalid message format:', msg);
        return false;
      }
      return true;
    });

    console.log(`Validated ${validMessages.length} of ${messages.length} messages`);

    if (validMessages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid messages after validation'
      });
    }

    const results = [];
    const errors = [];
    
    // Send messages one at a time as per API example
    for (const msg of validMessages) {
      try {
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
          body: responseText.substring(0, 100) // Log only first 100 chars to avoid huge logs
        });

        if (!response.ok) {
          const errorMsg = `Failed to send SMS to ${msg.recipientNumber}: ${response.status} - ${responseText}`;
          console.error(errorMsg);
          errors.push({
            number: msg.recipientNumber,
            error: errorMsg
          });
          continue; // Skip to next message
        }

        try {
          const result = JSON.parse(responseText);
          results.push(result);
        } catch (e) {
          console.log('Non-JSON response:', responseText);
          results.push({ status: 'sent', raw: responseText });
        }
      } catch (error) {
        console.error(`Error sending to ${msg.recipientNumber}:`, error);
        errors.push({
          number: msg.recipientNumber,
          error: error.message
        });
      }
    }

    // Return success if at least some messages were sent
    if (results.length > 0) {
      res.json({
        success: true,
        data: {
          results,
          totalSent: results.length,
          totalFailed: errors.length,
          errors: errors.length > 0 ? errors : undefined
        }
      });
    } else {
      // All messages failed
      res.status(500).json({
        success: false,
        error: 'Failed to send all messages',
        errors
      });
    }

  } catch (error) {
    console.error('Error in SMS endpoint:', error);
    res.status(500).json({
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
  console.log('Received balance request from:', req.headers.origin);
  console.log('Request headers:', req.headers);
  
  try {
    console.log('Making request to ZoomConnect API...');
    const response = await fetch('https://www.zoomconnect.com/app/api/rest/v1/account/balance', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'email': process.env.ZOOM_CONNECT_EMAIL,
        'token': process.env.ZOOM_CONNECT_KEY
      }
    });

    console.log('ZoomConnect API response status:', response.status);
    const responseText = await response.text();
    console.log('ZoomConnect API response:', responseText);

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}: ${responseText}`);
    }

    const data = JSON.parse(responseText);
    console.log('Parsed response data:', data);
    
    res.json({
      success: true,
      balance: data.creditBalance
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch SMS balance'
    });
  }
});

// Update the sent-messages endpoint with better pagination and date filtering
app.get('/api/sent-messages', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const afterDate = req.query.afterDate ? new Date(req.query.afterDate).getTime() : null;
    const beforeDate = req.query.beforeDate ? new Date(req.query.beforeDate).getTime() : null;
    const useCache = req.query.useCache !== 'false';
    
    console.log('Fetching messages with params:', { page, limit, afterDate, beforeDate, useCache });

    let allMessages = [];

    // Try to use cache if available and requested
    if (useCache && messageCache.messages.length > 0) {
      console.log('Using cached messages');
      allMessages = messageCache.messages;
    } else {
      // Fetch from API if cache not available or not requested
      let currentPage = 1;
      let hasMoreMessages = true;

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

        if (!response.ok) {
          throw new Error(`API responded with status ${response.status}`);
        }

        const data = await response.json();
        const messages = data.webServiceMessages || [];
        
        if (messages.length === 0) {
          hasMoreMessages = false;
          console.log('No more messages found');
          break;
        }

        // Check date boundaries
        const shouldContinue = messages.some(msg => {
          const msgDate = new Date(msg.dateTimeSent).getTime();
          if (afterDate && msgDate < afterDate) return false;
          if (beforeDate && msgDate > beforeDate) return false;
          return true;
        });

        // Filter messages within date range
        const filteredMessages = messages.filter(msg => {
          const msgDate = new Date(msg.dateTimeSent).getTime();
          if (afterDate && msgDate < afterDate) return false;
          if (beforeDate && msgDate > beforeDate) return false;
          return true;
        });

        allMessages = [...allMessages, ...filteredMessages];
        
        if (!shouldContinue) {
          hasMoreMessages = false;
          console.log('Reached date boundary');
        } else {
          currentPage++;
        }

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Apply date filters to cached messages if needed
    if (useCache && (afterDate || beforeDate)) {
      allMessages = allMessages.filter(msg => {
        const msgDate = new Date(msg.dateTimeSent).getTime();
        if (afterDate && msgDate < afterDate) return false;
        if (beforeDate && msgDate > beforeDate) return false;
        return true;
      });
    }

    console.log(`Total messages available: ${allMessages.length}`);

    // Group messages by content
    const messageGroups = {};
    
    allMessages.forEach(msg => {
      if (!msg.message) return;
      
      const messageKey = msg.message;
      
      if (!messageGroups[messageKey]) {
        messageGroups[messageKey] = {
          id: msg.messageId,
          message: msg.message,
          sentAt: msg.dateTimeSent,
          recipients: [],
          totalRecipients: 0,
          status: { delivered: 0, failed: 0, pending: 0 },
          totalCredits: 0
        };
      }

      const group = messageGroups[messageKey];
      const status = msg.messageStatus?.toLowerCase() || 'pending';
      
      // Check if recipient already exists
      const recipientExists = group.recipients.some(r => r.number === msg.toNumber);
      
      if (!recipientExists) {
        group.recipients.push({
          number: msg.toNumber,
          status: status,
          credits: msg.creditCost || 1
        });
        
        group.totalRecipients++;
        group.totalCredits += (msg.creditCost || 1);
        group.status[status]++;
      }
    });

    // Convert to array and sort by date
    const sortedGroups = Object.values(messageGroups)
      .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedGroups = sortedGroups.slice(startIndex, endIndex);

    console.log(`Returning ${paginatedGroups.length} messages (page ${page})`);

    res.json({
      success: true,
      messages: paginatedGroups,
      pagination: {
        page,
        limit,
        total: sortedGroups.length,
        hasMore: endIndex < sortedGroups.length
      },
      metadata: {
        lastFetched: useCache ? messageCache.lastUpdated : new Date().toISOString(),
        fromCache: useCache && messageCache.messages.length > 0,
        dateRange: {
          start: afterDate ? new Date(afterDate).toISOString() : null,
          end: beforeDate ? new Date(beforeDate).toISOString() : null
        }
      }
    });
  } catch (error) {
    console.error('Error in sent-messages endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch sent messages'
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

// Add inbox background fetch endpoint
app.post('/api/messages/inbox-background-fetch', async (req, res) => {
  try {
    if (isUpdatingInboxCache) {
      return res.json({ success: true, message: 'Cache update already in progress' });
    }

    // Start background fetch
    isUpdatingInboxCache = true;
    backgroundFetchInboxMessages().catch(console.error);

    res.json({ success: true, message: 'Started background fetch of inbox messages' });
  } catch (error) {
    console.error('Error starting inbox background fetch:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add inbox cache status endpoint
app.get('/api/messages/inbox-cache-status', (req, res) => {
  res.json({
    success: true,
    isUpdating: isUpdatingInboxCache,
    lastUpdated: lastInboxUpdate,
    totalMessages: inboxMessagesCache?.webServiceMessages?.length || 0
  });
});

// Update inbox messages endpoint to use cache
app.get('/api/inbox-messages', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const useCache = req.query.useCache !== 'false';

    console.log('Fetching inbox messages with params:', { page, limit, useCache });

    let messages = [];
    if (useCache && inboxMessagesCache?.webServiceMessages?.length > 0) {
      console.log('Using cached messages');
      messages = [...inboxMessagesCache.webServiceMessages];
    } else {
      console.log('Fetching fresh messages from API');
      const response = await fetch(`https://www.zoomconnect.com/app/api/rest/v1/messages/all?type=INBOUND&page=${page}&pageSize=100`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'email': process.env.ZOOM_CONNECT_EMAIL,
          'token': process.env.ZOOM_CONNECT_KEY
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`API request failed with status ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const errorText = await response.text();
        console.error('Invalid Content-Type:', contentType, 'Response:', errorText);
        throw new Error('API returned non-JSON response');
      }

      const data = await response.json();
      if (!data || !Array.isArray(data.webServiceMessages)) {
        console.error('Invalid API Response:', data);
        throw new Error('Invalid response format from API');
      }
      messages = [...data.webServiceMessages];
    }

    // Sort messages by date in descending order (latest first)
    const sortedMessages = messages.sort((a, b) => {
      const dateA = new Date(a.dateTimeReceived || a.dateTime);
      const dateB = new Date(b.dateTimeReceived || b.dateTime);
      return dateB - dateA;
    });

    // Calculate pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedMessages = sortedMessages.slice(startIndex, endIndex);

    // Format messages for frontend
    const formattedMessages = paginatedMessages.map(msg => ({
      messageId: msg.messageId,
      message: msg.message,
      dateTimeReceived: msg.dateTimeReceived || msg.dateTime,
      fromNumber: msg.fromNumber,
      messageStatus: msg.messageStatus || 'received',
      creditCost: msg.creditCost || 0
    }));

    res.json({
      success: true,
      messages: formattedMessages,
      pagination: {
        page,
        limit,
        total: sortedMessages.length,
        hasMore: endIndex < sortedMessages.length
      },
      metadata: {
        fromCache: useCache && inboxMessagesCache?.webServiceMessages?.length > 0,
        lastFetched: lastInboxUpdate
      }
    });
  } catch (error) {
    console.error('Error fetching inbox messages:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.stack
    });
  }
});

// In-memory cache for messages
const messageCache = {
  messages: [],
  lastUpdated: null,
  isUpdating: false
};

// Background message fetch endpoint
app.post('/api/messages/background-fetch', async (req, res) => {
  try {
    // If already updating, return status
    if (messageCache.isUpdating) {
      return res.json({
        success: true,
        status: 'in_progress',
        lastUpdated: messageCache.lastUpdated
      });
    }

    // Start background fetch
    messageCache.isUpdating = true;
    
    // Send immediate response
    res.json({
      success: true,
      status: 'started',
      lastUpdated: messageCache.lastUpdated
    });

    // Perform fetch in background
    try {
      let allMessages = [];
      let currentPage = 1;
      let hasMoreMessages = true;

      while (hasMoreMessages) {
        console.log(`Background fetch: page ${currentPage}`);
        
        const response = await fetch(`https://www.zoomconnect.com/app/api/rest/v1/messages/all?type=OUTBOUND&page=${currentPage}&pageSize=100`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'email': process.env.ZOOM_CONNECT_EMAIL,
            'token': process.env.ZOOM_CONNECT_KEY
          }
        });

        if (!response.ok) {
          throw new Error(`API responded with status ${response.status}`);
        }

        const data = await response.json();
        const messages = data.webServiceMessages || [];
        
        if (messages.length === 0) {
          hasMoreMessages = false;
          console.log('Background fetch: No more messages');
          break;
        }

        allMessages = [...allMessages, ...messages];
        currentPage++;

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Update cache
      messageCache.messages = allMessages;
      messageCache.lastUpdated = new Date().toISOString();
      console.log(`Background fetch complete: ${allMessages.length} messages cached`);
    } catch (error) {
      console.error('Background fetch error:', error);
    } finally {
      messageCache.isUpdating = false;
    }
  } catch (error) {
    console.error('Error starting background fetch:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start background fetch'
    });
  }
});

// Cache status endpoint
app.get('/api/messages/cache-status', (req, res) => {
  res.json({
    success: true,
    isUpdating: messageCache.isUpdating,
    lastUpdated: messageCache.lastUpdated,
    totalMessages: messageCache.messages.length
  });
});

// Add background fetch function for inbox
async function backgroundFetchInboxMessages() {
  console.log('Starting background fetch of inbox messages...');
  const allMessages = [];
  let page = 1;
  let hasMore = true;

  try {
    while (hasMore) {
      console.log(`Fetching inbox page ${page}...`);
      const response = await fetch(`https://www.zoomconnect.com/app/api/rest/v1/messages/all?type=INBOUND&page=${page}&pageSize=100`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'email': process.env.ZOOM_CONNECT_EMAIL,
          'token': process.env.ZOOM_CONNECT_KEY
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error Response (Page ${page}):`, errorText);
        throw new Error(`API request failed with status ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const errorText = await response.text();
        console.error('Invalid Content-Type:', contentType, 'Response:', errorText);
        throw new Error('API returned non-JSON response');
      }

      const data = await response.json();
      if (!data || !Array.isArray(data.webServiceMessages)) {
        console.error('Invalid API Response:', data);
        throw new Error('Invalid response format from API');
      }

      const messages = data.webServiceMessages;
      console.log(`Found ${messages.length} inbox messages on page ${page}`);

      if (messages.length === 0) {
        hasMore = false;
      } else {
        allMessages.push(...messages);
        page++;
      }

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Sort messages by date before caching
    const sortedMessages = allMessages.sort((a, b) => {
      const dateA = new Date(a.dateTimeReceived || a.dateTime);
      const dateB = new Date(b.dateTimeReceived || b.dateTime);
      return dateB - dateA;
    });

    // Update cache with proper structure
    inboxMessagesCache = {
      webServiceMessages: sortedMessages
    };
    lastInboxUpdate = new Date().toISOString();
    console.log(`Background fetch complete: ${allMessages.length} inbox messages cached`);
  } catch (error) {
    console.error('Error in background fetch:', error);
    // Reset cache status on error
    isUpdatingInboxCache = false;
    throw error;
  } finally {
    isUpdatingInboxCache = false;
  }
}

const PORT = process.env.PORT || 3001;
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