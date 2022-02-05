const assert = require('assert');
const fetch = require('node-fetch');
const { baseURL } = require('./_config');

describe('Creators routes', () => {
	var firstCreatorId;

	describe('GET /creators', () => {
		it('Should show creators', async() => {
			var res = await fetch(baseURL + '/creators');
			assert(res.status == 200);
			var html = await res.text();
			assert(/<h1>Creators<\/h1>/.test(html));

			var m = /<a href="\/creators\/(\d+)">/.exec(html);
			assert(m, "Couldn't find a link for a creator");
			firstCreatorId = parseInt(m[1]);
		});
	});

	describe('GET /creators/:id', () => {
		it('Should show a creator', async() => {
			var res = await fetch(baseURL + '/creators/' + firstCreatorId);
			assert(res.status == 200);
			var html = await res.text();
			assert(/<h1>.*?<\/h1>/.test(html));
		});
	})
})