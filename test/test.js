var config = {
	baseURL: 'http://localhost:3000'
};

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
