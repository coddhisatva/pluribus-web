module.exports = (req, res, next) => {
	function getFlashCookie(name) {
		var value = req.cookies['flash-' + name];

		// If there is a cookie in the outgoing response, that overrides any previously set cookies.
		var resCookies = res.get('Set-Cookie');
		if(resCookies) {
			if(typeof(resCookies)==='string') {
				resCookies = [resCookies];
			};

			for(var i = 0; i < resCookies.length; i++) {
				var sep = resCookies[i].indexOf('=');
				var cookieName = resCookies[i].substring(0, sep);
				if(cookieName == 'flash-' + name) {
					var cookieValue = resCookies[i].substring(sep+1).split(';',2)[0];
					value = decodeURIComponent(cookieValue);

					resCookies.splice(i, 1);
					if(resCookies.length == 0) {
						res.removeHeader('Set-Cookie');
					} else {
						if(resCookies.length == 1) {
							resCookies = resCookies[0]; // Get the first string value
						}
						res.set('Set-Cookie', resCookies);
					}
					break;
				}
			}
		}

		// Clear the cookie once it has been accessed.
		res.clearCookie('flash-' + name);
		return value;
	}
	function setFlashCookie(name, value) {
		res.cookie('flash-' + name, value);
	}

	req.flash = {
		get alert() {
			return getFlashCookie('alert');
		},
		set alert(value) {
			setFlashCookie('alert', value);
		},
		get notice() {
			return getFlashCookie('notice');
		},
		set notice(value) {
			setFlashCookie('notice', value);
		}
	};
	res.locals.flash = req.flash;
	next();
}