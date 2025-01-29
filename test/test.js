const config = {
	baseURL: 'http://localhost:3000'
};

const testServer = require('./testServer');

// Start server before all tests
before(async () => {
	await testServer.start();
});

// Stop server after all tests
after(async () => {
	await testServer.stop();
});

function integrationTests() {
	describe('Routes', () => {
		require('./routes/index.js')(config);
		require('./routes/users.js')(config);
		require('./routes/creators.js')(config);
	});
	
	describe('Utils', () => {
		require('./utils/auth.js');
	});
}

integrationTests();
