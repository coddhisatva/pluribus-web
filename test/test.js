const config = {
	baseURL: 'http://localhost:3000'
};

const testServer = require('./testServer');
const fs = require('fs').promises;

// Add timeout configuration
const TEST_TIMEOUT = 30000; // Increase to 30 seconds

// Start server before all tests
before(async function() {
	this.timeout(TEST_TIMEOUT);
	// Create test email directory
	await fs.mkdir('data/test/email', { recursive: true });
	await testServer.start();
});

// Stop server after all tests
after(async function() {
	this.timeout(TEST_TIMEOUT);
	try {
		await fs.rm('data/test/email', { recursive: true });
	} catch (err) {
		console.log('Could not remove test email directory:', err);
	}
	await testServer.stop();
});

// Change to use Mocha's describe
describe('Integration Tests', function() {
	// Now this.timeout will work because we're in Mocha context
	this.timeout(TEST_TIMEOUT);

	describe('Routes', () => {
		require('./routes/index.js')(config);
		require('./routes/users.js')(config);
		require('./routes/creators.js')(config);
	});
	
	describe('Utils', () => {
		require('./utils/auth.js');
	});

	describe('Integration', () => {
		require('./integration/policyExecution.test.js');
	});
});
