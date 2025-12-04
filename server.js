// server.js (improved logging + resilient parsing)

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Use environment variable for webhook URL with fallback to default
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://buford-tzaristic-elliana.ngrok-free.dev/webhook/n8n-endpoint';

// Add middleware to handle potential CORS if needed
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).send('Error loading the application');
    }
  });
});

// Handle all other routes by serving index.html (for SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) {
      console.error('Error serving index.html for route:', req.originalUrl);
      res.status(500).send('Error loading the application');
    }
  });
});

// Endpoint yang dipanggil dari frontend (index.html)
app.post('/ask', async (req, res) => {
  // Terima baik "message" (dari frontend) maupun "query" (kalau nanti ingin tes langsung ke server.js)
  const userMessage = (req.body && (req.body.message || req.body.query)) || '';
  console.log('🟦 Pesan diterima dari UI/server:', userMessage);

  if (!userMessage.toString().trim()) {
    return res.status(400).json({ success: false, error: 'Pesan tidak boleh kosong.' });
  }

  try {
    // Kirim ke n8n: body { query: "teks user" }
    const axiosResp = await axios.post(
      N8N_WEBHOOK_URL,
      { query: userMessage },
      { timeout: 20000 },
    );

    console.log('🟩 Status dari n8n:', axiosResp.status);
    console.log('🟩 Headers dari n8n:', axiosResp.headers && axiosResp.headers['content-type']);
    console.log('🟩 Body (raw) dari n8n:', JSON.stringify(axiosResp.data, null, 2));

    let answer = null;

    // Format utama yang kita harapkan: { "response": "teks jawaban" }
    if (axiosResp.data && typeof axiosResp.data === 'object') {
      if (typeof axiosResp.data.response === 'string') {
        answer = axiosResp.data.response;
      } else if (axiosResp.data.output && typeof axiosResp.data.output === 'string') {
        // Cadangan kalau Respond to Webhook mengembalikan { "output": "..." }
        answer = axiosResp.data.output;
      } else if (Array.isArray(axiosResp.data) && axiosResp.data[0]) {
        // Cadangan untuk bentuk array dari n8n
        if (typeof axiosResp.data[0].response === 'string') {
          answer = axiosResp.data[0].response;
        } else if (typeof axiosResp.data[0].output === 'string') {
          answer = axiosResp.data[0].output;
        }
      }
    }

    // Jika tetap belum ketemu, stringify seluruh respons supaya tetap ada yang ditampilkan
    if (!answer) {
      answer = typeof axiosResp.data === 'string'
        ? axiosResp.data
        : JSON.stringify(axiosResp.data);
    }

    return res.json({ success: true, reply: answer });
  } catch (err) {
    console.error('❌ Error saat memanggil n8n:', err.message);
    if (err.response) {
      console.error('❌ Response status dari n8n:', err.response.status);
      console.error('❌ Response body dari n8n:', JSON.stringify(err.response.data, null, 2));
    } else if (err.request) {
      console.error('❌ Tidak ada response (request dibuat, tapi tidak ada respons):', err.request);
    } else {
      console.error('❌ Error lainnya:', err);
    }

    return res.status(500).json({
      success: false,
      error: 'Gagal memproses permintaan ke n8n.',
      detail: err.response ? err.response.data : err.message,
    });
  }
});

// Only start server if running locally (not in serverless environment)
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`🚀 WebApp berjalan di http://localhost:${port}`);
    console.log(`🔗 Webhook n8n: ${N8N_WEBHOOK_URL}`);
  });
}

module.exports = app;
