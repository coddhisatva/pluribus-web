const assert = require('assert');
const fetch = require('node-fetch');
const { baseURL } = require('./_config');

describe('Users routes', () => {
	describe('GET /users/login', () => {
		it('Should show login page', async () => {
			var res = await fetch(baseURL + '/users/login');
			assert(res.status == 200);
			var html = await res.text();
			assert(/<h1>Login<\/h1>/.test(html));
		})
	})
});