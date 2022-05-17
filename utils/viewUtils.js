var csrf = require('./csrf');

var globalFuncs = {
	/**
	 * Converts the supplied string to camel case.
	 * E.g.
	 * 	"camel case String" => "CamelCaseString";
	 *  "snake_case_string" => "SnakeCaseString";
	 * @param {String} str - the string to camelize.
	 * @param {Boolean} lcaseFirst - whether to make the first character lower case (false by default).
	 * @returns 
	 */
	camelize: function(str, lcaseFirst) {
		var camel = str.replace(/[_\s](.)/, function(match, p1) {
			return p1.toUpperCase();
		});

		camel = (lcaseFirst ? camel[0].toLowerCase() : camel[0].toUpperCase()) + camel.substring(1);
		return camel;
	},
	cardExpiryDisplay: function(expMonth, expYear) {
		var result  = (expMonth < 10 ? '0' : '') + expMonth + '/';
		if(expYear > 2000 && expYear < 2100) {
			result += expYear % 100;
		} else {
			result += expYear;
		}
		return result;
	}
};

// Functions that use the current request / response
var reqResFuncs = {
	csrfToken: csrf.newToken
}

function middleware(req, res, next) {
	for(var fn in globalFuncs) {
		res.locals[fn] = globalFuncs[fn];
	}

	for(var fn in reqResFuncs) {
		res.locals[fn] = reqResFuncs[fn](req, res);
	}
	next();
}

module.exports = middleware;