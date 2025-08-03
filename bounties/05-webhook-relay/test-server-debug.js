const http = require('http');

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', () => {
    console.log('Body:', body);
    
    // Always return success
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true, 
      received: body ? JSON.parse(body) : null,
      timestamp: new Date().toISOString()
    }));
  });
});

const port = 3001;
server.listen(port, () => {
  console.log(`Test server running on http://localhost:${port}`);
});

// Keep server running
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    process.exit(0);
  });
});