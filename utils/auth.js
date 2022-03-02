const crypto = require('crypto');

var auth = {
	/**
	 * Returns a Base-64 encoded hash of the supplied password.
	 * @param {String} password 
	 * @returns a Base-64 encoded hash
	 */
	hashPassword: function(password) {
		const iterations = 10000;
		var salt = new Uint8Array(24);
		crypto.randomFillSync(salt);

		const hash = crypto.pbkdf2Sync(password, salt, iterations, 24, 'sha1');

		var base64 = (bytes) => Buffer.from(bytes).toString('base64');

		return `${iterations}:${base64(salt)}:${base64(hash)}`;
	},
  
	/**
	 * Verifies whether a password matches the stored hash of the password.
	 * @param {String} password 
	 * @param {String} storedHash 
	 * @returns true if the password matches the stored hash; otherwise, false.
	 */
	verifyPassword: function(password, storedHash) {
		var [ iterations, salt, hash ] = storedHash.split(':');

		iterations = parseInt(iterations);
		salt = Buffer.from(salt, 'base64');
		hash = Buffer.from(hash, 'base64');

		var testHash = crypto.pbkdf2Sync(password, salt, iterations, hash.length, 'sha1');

		return Buffer.compare(hash, testHash) == 0;
	},

	/**
	 * Middleware function to load the authenticated user from
	 * session cookie into locals.authUser.
	 */
	inject: function(req, res, next) {
		if(req.session && req.session.authUser) {
			req.authUser = res.locals.authUser = req.session.authUser;
		}
		next();
	},

	authorize: function(req, res, next) {
		var authorized = res.locals.authUser != null;
		if(!authorized) {
			req.flash.alert = 'Please log in to continue.';
			res.status(401).redirect('/users/login?redirect=' + encodeURIComponent(req.originalUrl));
			return;
		}

		next();
	},

	oneTimeCode: function(length) {
		var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

		var result = '';
		for(var i = 0; i < length; i++) {
			result += chars[Math.floor(Math.random() * chars.length)];
		}

		return result;
	}
}

module.exports = auth;