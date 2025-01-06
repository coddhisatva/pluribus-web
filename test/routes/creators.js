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
	});
}