const assert = require('assert');
const auth = require('../utils/auth');

describe('Auth', () => {
	describe('Password hashes', () => {
		it('Should be able to verify a hash', () => {
			var password = '$ecureP@ssw0rd';
			var hash = auth.hashPassword(password);

			assert(auth.verifyPassword(password, hash));
			assert(!auth.verifyPassword('@differ3nt0ne', hash));
		})
	});
});