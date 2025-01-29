// Force test environment
process.env.NODE_ENV = 'test';

// Import Mocha functions
const { before, after } = require('mocha');

// Load test config
const testConfig = require('../config/test');
const credentials = require('../config/credentials');
Object.assign(credentials, testConfig);

// Override require('stripe') to use our mock
const stripeMock = require('./mocks/stripe');
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(path) {
  if (path === 'stripe') {
    return function() {
      return stripeMock;
    }
  }
  return originalRequire.apply(this, arguments);
};

// Set environment variables that the server will use
process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
process.env.STRIPE_PUBLIC_KEY = 'pk_test_mock';

// Also set in credentials config
try {
  const credentials = require('../config/credentials');
  credentials.stripe = {
    secretKey: 'sk_test_mock',
    publicKey: 'pk_test_mock'
  };
} catch (e) {
  console.log('Could not update credentials:', e);
}

// Add product retrieval to mock
stripeMock.products = {
  retrieve: async () => ({
    id: 'prod_test123',
    default_price: {
      id: 'price_test123',
      unit_amount: 1000 // $10.00
    }
  })
};

const testServer = require('./testServer');

// Remove the before/after hooks from here

// Add to test setup
jest.mock('stripe', () => require('./mocks/stripe'));