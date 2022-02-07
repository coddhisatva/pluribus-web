const assert = require("assert");
const fetch = require("node-fetch");
const config = require('./_config');

describe('Index routes', () => {
	describe('GET /', () => {
		it('Should welcome us.', async () => {
			var res = await fetch(config.baseURL + '/');

			assert(res.status === 200);
			var html = await res.text();
			assert(/Welcome to Pluribus/.test(html));
		})
	});
});