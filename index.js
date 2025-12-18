const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow all origins (important for Arduino)
app.use(bodyParser.urlencoded({ extended: true })); // For form data
app.use(bodyParser.json()); // For JSON data
app.use(express.text()); // For plain text

// Store data in memory (for testing)
let sensorData = [];
let apiStats = {
  totalRequests: 0,
  successfulPosts: 0,
  lastRequest: null
};

// ==================== API ROUTES ====================

// POST endpoint for Arduino data
app.post('/api/data', (req, res) => {
  apiStats.totalRequests++;
  apiStats.lastRequest = new Date().toISOString();
  
  console.log(`📥 Received POST to /api/data`);
  console.log(`📊 Headers:`, req.headers);
  console.log(`📦 Body:`, req.body);
  
  try {
    let temperature, humidity;
    
    // Parse data based on content type
    const contentType = req.headers['content-type'] || '';
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      // Form data: temp=25.5&hum=60.0
      temperature = parseFloat(req.body.temp) || 0;
      humidity = parseFloat(req.body.hum) || 0;
    } else if (contentType.includes('application/json')) {
      // JSON data
      temperature = parseFloat(req.body.temp) || 0;
      humidity = parseFloat(req.body.hum) || 0;
    } else {
      // Try to parse as query string
      const bodyString = String(req.body);
      const tempMatch = bodyString.match(/temp=([\d.]+)/);
      const humMatch = bodyString.match(/hum=([\d.]+)/);
      
      temperature = tempMatch ? parseFloat(tempMatch[1]) : 0;
      humidity = humMatch ? parseFloat(humMatch[1]) : 0;
    }
    
    // Create data entry
    const dataEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      temperature: temperature,
      humidity: humidity,
      receivedAt: new Date().toLocaleString(),
      client: req.headers['user-agent'] || 'Unknown'
    };
    
    // Store in memory (limit to last 100 entries)
    sensorData.unshift(dataEntry);
    if (sensorData.length > 100) {
      sensorData = sensorData.slice(0, 100);
    }
    
    apiStats.successfulPosts++;
    
    console.log(`✅ Data stored: Temp=${temperature}, Hum=${humidity}`);
    
    // Send Arduino-friendly response
    res.status(200).json({
      success: true,
      message: 'Data received successfully',
      data: dataEntry,
      count: sensorData.length,
      server: 'Node.js API on Render'
    });
    
  } catch (error) {
    console.error(`❌ Error:`, error);
    res.status(400).json({
      success: false,
      error: error.message,
      help: 'Send data as: temp=25.5&hum=60.0'
    });
  }
});

// GET endpoint to view all data
app.get('/api/data', (req, res) => {
  res.json({
    success: true,
    count: sensorData.length,
    data: sensorData,
    stats: apiStats
  });
});

// GET endpoint for Arduino test (simple text response)
app.get('/api/test', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send('OK - Node.js API is working!');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    server: 'Arduino Sensor API',
    runtime: 'Node.js ' + process.version,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    requests: apiStats
  });
});

// Simple GET test with query parameters
app.get('/api/simple', (req, res) => {
  const temp = req.query.temp || '0';
  const hum = req.query.hum || '0';
  
  const entry = {
    timestamp: new Date().toISOString(),
    temperature: temp,
    humidity: hum,
    method: 'GET'
  };
  
  sensorData.unshift(entry);
  
  res.json({
    received: true,
    data: entry
  });
});

// HTML dashboard to view data
app.get('/dashboard', (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Arduino Sensor Dashboard</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; }
      .data-card { 
        background: #f5f5f5; 
        padding: 15px; 
        margin: 10px 0; 
        border-radius: 5px;
      }
      .success { color: green; }
      .error { color: red; }
    </style>
  </head>
  <body>
    <h1>📱 Arduino Sensor Dashboard</h1>
    <p>Total readings: ${sensorData.length}</p>
    <div id="data-container">
      ${sensorData.slice(0, 10).map(item => `
        <div class="data-card">
          <strong>${new Date(item.timestamp).toLocaleString()}</strong><br>
          🌡️ Temp: ${item.temperature}°C | 💧 Hum: ${item.humidity}%
        </div>
      `).join('')}
    </div>
    <p><a href="/api/data">View all data as JSON</a></p>
    <p><a href="/api/health">Server health</a></p>
  </body>
  </html>
  `;
  
  res.send(html);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Arduino Sensor API',
    endpoints: {
      postData: 'POST /api/data',
      getData: 'GET /api/data',
      health: 'GET /api/health',
      test: 'GET /api/test',
      simple: 'GET /api/simple?temp=25&hum=60',
      dashboard: 'GET /dashboard'
    },
    note: 'Send sensor data as: temp=25.5&hum=60.0'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Arduino Sensor API running on port ${PORT}`);
  console.log(`📡 Endpoints:`);
  console.log(`   POST /api/data    - Receive sensor data`);
  console.log(`   GET  /api/data    - View all data`);
  console.log(`   GET  /api/health  - Server health`);
  console.log(`   GET  /dashboard   - Web dashboard`);
});