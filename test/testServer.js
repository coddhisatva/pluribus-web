const app = require('../app');
const http = require('http');

let server;

module.exports = {
  start: () => {
    return new Promise((resolve, reject) => {
      server = http.createServer(app);
      server.listen(3000);
      server.on('listening', () => {
        console.log('Test server started on port 3000');
        resolve();
      });
      server.on('error', reject);
    });
  },

  stop: () => {
    return new Promise((resolve) => {
      if (server) {
        server.close(() => {
          console.log('Test server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}; 