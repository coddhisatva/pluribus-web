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
	}
};

function middleware(req, res, next) {
	for(var fn in globalFuncs) {
		res.locals[fn] = globalFuncs[fn];
	}
	next();
}

module.exports = middleware;