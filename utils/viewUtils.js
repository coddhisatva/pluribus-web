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
	},
	/**
	 * Displays the date relative to the current time, e.g. 3 minutes ago
	 * @param {Date} date 
	 */
	when: function(date) {
		var now = new Date();
		var diff = (now - date);
		
		if(diff < 0) return date; // Not supported for future dates
		var seconds =  diff / 1000;

		if(seconds < 90) {
			return 'seconds ago';
		}

		var minutes = seconds / 60;
		if(minutes < 90) {
			return Math.round(minutes) + ' minutes ago';
		}

		var hours = minutes / 60.0;
		if(hours < 36) {
			return Math.round(hours) + ' hours ago';
		}

		var days = hours / 24.0;
		if(days < 11) {
			return Math.round(days) + ' days ago';
		}

		var weeks = days / 7.0;
		if(weeks < 7) {
			return Math.round(weeks) + ' weeks ago';
		}

		var months = days / 30;
		const monthNames = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
		if(months < 12) {
			if(date.getFullYear() == now.getFullYear()) {
				return monthNames[date.getMonth() - 1] + ' ' + date.getDate();
			}
			return monthNames[date.getMonth() - 1] + ' ' + date.getDate() + ', ' + date.getFullYear();
		}

		return date;

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