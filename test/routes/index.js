const assert = require("assert");
const fetch = require("node-fetch");

module.exports = (config) => {
	describe('Index routes', () => {
		describe('GET /', () => {
			it('Should show the homepage', async () => {
				var res = await fetch(config.baseURL + '/');
	
				assert(res.status === 200);
				var html = await res.text();
				assert(/Introducing the Pluribus parachute/.test(html));
			})
		});
	});
};
