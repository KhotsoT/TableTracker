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
    
    console.log('Sending bulk SMS to', messages.length, 'recipients');

    // Send messages in batches of 100 (or whatever their API limit is)
    const BATCH_SIZE = 100;
    const results = [];

    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      
      const requestBody = {
        messages: batch.map(msg => ({
          recipientNumber: msg.recipientNumber,
          message: msg.content
        })),
        senderId: "School"
      };

      console.log(`Sending batch ${i/BATCH_SIZE + 1}:`, {
        batchSize: batch.length,
        totalBatches: Math.ceil(messages.length/BATCH_SIZE)
      });

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

      const result = await response.text();
      console.log('Batch response:', {
        status: response.status,
        body: result
      });

      if (!response.ok) {
        throw new Error(`Failed to send batch: ${response.status} - ${result}`);
      }

      results.push(result);
    }

    res.json({
      success: true,
      data: {
        batchResults: results,
        totalSent: messages.length
      }
    });

  } catch (error) {
    console.error('Error:', error);
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