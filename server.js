const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/send-sms', async (req, res) => {
  try {
    const response = await fetch('https://www.zoomconnect.com/app/api/rest/v1/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiToken': process.env.ZOOM_CONNECT_KEY
      },
      body: JSON.stringify(req.body)
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Proxy server running on port 3000');
}); 