const assert = require('assert');
const fetch = require('node-fetch');

module.exports = (config) => {
	var baseURL = config.baseURL;

	describe('Creators', () => {
		var firstCreatorId;

		describe('GET /creators', () => {
			it('Should show creators', async() => {
				var res = await fetch(baseURL + '/creators');
				assert(res.status == 200);
				var html = await res.text();
				assert(/<h1[^>]*>Featured creators<\/h1>/.test(html));

				var m = /href="\/creators\/(\d+)"/.exec(html);
				assert(m, "Couldn't find a link for a creator");
				firstCreatorId = parseInt(m[1]);
				console.log('Found creator ID:', firstCreatorId);
			});
		});

		describe('GET /creators/:id', () => {
			it('Should show a creator', async() => {
				var res = await fetch(baseURL + '/creators/' + firstCreatorId);
				assert(res.status == 200);
				var html = await res.text();
				assert(/<h1[^>]*>.*?<\/h1>/.test(html));
			});
		});

		describe('Creator Pledge Flow', () => {
			it('Should handle creator subscription flow', async() => {
				console.log('Starting subscription flow test...');
				
				// First do login and get auth cookies
				const loginPageRes = await fetch(baseURL + '/users/login');
				const loginHtml = await loginPageRes.text();
				const csrfMatch = loginHtml.match(/<input[^>]*name="_csrfToken"[^>]*value="([^"]*)"[^>]*>/);
				const csrfToken = csrfMatch[1];

				// Do login
				const loginRes = await fetch(baseURL + '/users/login', {
					method: 'POST',
					headers: { 
						'Content-Type': 'application/x-www-form-urlencoded',
						'Cookie': loginPageRes.headers.raw()['set-cookie'].join('; ')
					},
					redirect: 'manual',
					body: new URLSearchParams({
						email: 'testcreator12@test.com',
						password: 'test123',
						_csrfToken: csrfToken
					}).toString()
				});

				const authCookies = loginRes.headers.raw()['set-cookie'];

				// Now try pledge page with auth cookies - using creator ID 1 from test data
				const pledgeRes = await fetch(baseURL + '/creators/1/pledge', {
					headers: { 
						Cookie: authCookies.join('; ')
					}
				});

				console.log('Pledge response status:', pledgeRes.status);
				const responseText = await pledgeRes.text();
				
				// Updated assertions
				assert.equal(pledgeRes.status, 200, 'Should get pledge page');
				assert(!responseText.includes('Log in - Pluribus'), 'Should not redirect to login page');
				assert(responseText.includes('pledge') || responseText.includes('Stripe'), 'Should show pledge/Stripe form');
			});
		});

		describe('Login Flow', () => {
			it('Should login successfully', async() => {
				// First get the login page
				const loginPageRes = await fetch(baseURL + '/users/login');
				const loginHtml = await loginPageRes.text();
				
				// Get CSRF token
				const csrfMatch = loginHtml.match(/<input[^>]*name="_csrfToken"[^>]*value="([^"]*)"[^>]*>/);
				const csrfToken = csrfMatch[1];
				console.log('Using CSRF token:', csrfToken);

				// Do login POST
				const loginRes = await fetch(baseURL + '/users/login', {
					method: 'POST',
					headers: { 
						'Content-Type': 'application/x-www-form-urlencoded',
						'Cookie': loginPageRes.headers.raw()['set-cookie'].join('; ')
					},
					redirect: 'manual', // Don't auto-follow redirects
					body: new URLSearchParams({
						email: 'testcreator12@test.com',
						password: 'test123',
						_csrfToken: csrfToken
					}).toString()
				});

				console.log('Login response status:', loginRes.status);
				console.log('Login response headers:', loginRes.headers.raw());
				
				// Should get a 302 redirect with auth cookies
				assert.equal(loginRes.status, 302, 'Should redirect after login');
				assert(loginRes.headers.has('set-cookie'), 'Should set auth cookies');
			});
		});
	});
}