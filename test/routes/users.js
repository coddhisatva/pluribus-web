const assert = require('assert');
const fetch = require('node-fetch');

module.exports = (config) => {
	var baseURL = config.baseURL;
	
	describe('Users routes', () => {
		describe('GET /users/login', () => {
			it('Should show login page', async () => {
				var res = await fetch(baseURL + '/users/login');
				assert(res.status == 200);
				var html = await res.text();
				console.log('Login page h1:', html.match(/<h1[^>]*>(.*?)<\/h1>/)?.[0]);
				assert(/<h1[^>]*>Log in to Pluribus<\/h1>/.test(html));
			})
		});
	});
}