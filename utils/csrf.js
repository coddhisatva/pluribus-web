var crypto = require('crypto');

var csrf = {
	newToken: function(req, res) {
		return function() {
			var token = crypto.randomUUID();
			req.session._csrfToken = token;
			return '<input type="hidden" name="_csrfToken" value="' + token + '" />';
		}
	},
	validateToken: function(req, res, next) {
		var postedToken = req.body['_csrfToken'];
		if(postedToken == req.session._csrfToken) {
			next();
		} else {
			res.status(405).send('Invalid request. Please try again.');
		}
		
	}
}

module.exports = csrf;