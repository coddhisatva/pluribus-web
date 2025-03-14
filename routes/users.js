const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../utils/auth');
const csrf = require('../utils/csrf');
const email = require('../utils/email');
require('../utils/handleAsyncErrors').fixRouter(router);
const { Creator, Follow, Guild, OneTimeCode, User, sequelize } = require('../models');  

/* GET /login */
router.get('/login', (req, res, next) => {
	res.render('users/login');
});

// TODO: delete this
router.get('/test-error', async (req, res, next) => {
	var x = next.j;
	var p = x.y;
	res.send('testing');
});

/* POST /login (email:string, password:string, remember:1) */
router.post('/login',
	csrf.validateToken,
	body('email').trim().isLength({min:1}).withMessage('Email is required').bail()
		.isEmail().withMessage('Invalid email address'),
	body('password', 'Please enter your password').trim().isLength({min:1}),

	async function(req, res, next) {
		console.log('=== LOGIN ATTEMPT ===');
		console.log('Body:', req.body);
		console.log('Looking for user in database...');
		const errors = validationResult(req).array();

		var user;
		if(errors.length == 0) {
			console.log('Attempting login with:', req.body.email);
			// Try raw query first
			const [results] = await sequelize.query(
				"SELECT * FROM Users WHERE email = :email",
				{
					replacements: { email: req.body.email },
					logging: console.log
				}
			);
			console.log('Raw query results:', results);

			user = await User.findOne({ 
				where: { email: req.body.email },
				logging: console.log
			});
			console.log('Login attempt:', {
				email: req.body.email,
				userFound: !!user,
				password: req.body.password,
				storedHash: user?.password,
				roles: user?.roles
			});
			if (user) {
				console.log('Found user:', {
					id: user.id,
					email: user.email,
					password: user.password,
					roles: user.roles
				});
			} else {
				console.log('No user found with email:', req.body.email);
			}
			if(!user) {
				console.log('User not found');
				errors.push({ msg: 'Unknown user', param: 'email' });
			} else if(!auth.verifyPassword(req.body.password, user.password)) {
				console.log('Password verification failed');
				console.log('Attempted:', req.body.password);
				console.log('Stored hash:', user.password);
				errors.push({ msg: 'Invalid password', param: 'password' });
			}
		}

		if(errors.length > 0) {
			res.render('users/login', { errors: errors })
			return;
		}

		var remember = req.body.remember == '1';
		var creator = await Creator.count({ where: { userId: user.id }});
		var guildAdmin = await Guild.count({ where: { userId: user.id } });

		// Save authentication cookie
		var roles = [ ];
		if (user.roles) {
			roles = roles.concat(user.roles);
		}
		if(creator > 0) {
			roles.push('creator');
		}
		if(guildAdmin > 0) {
			roles.push('guildAdmin');
		}

		req.session.authUser = { id: user.id, email: user.email, name: user.name, roles };
		console.log('Setting session with roles:', req.session.authUser);
		if(remember) {
			req.sessionOptions.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
		}

		req.flash.notice = "Welcome back!";

		var redirect = req.query.redirect;
		if(redirect) {
			res.redirect(redirect);
		} else if(req.query.invite) {
			res.redirect('/invite/' + encodeURIComponent(req.query.invite));
		} else {
			res.redirect('/');
		}
	}
);

/**
 * GET /logout
 */
router.get('/logout', async function(req, res, next) {
	req.session = null;
	req.flash.notice = 'You\'ve been logged out.';
	res.redirect('/');
});

/**
 * GET /password
 * Shows a form for a user to request a password reset ('Forgot password?' page).
 */
router.get('/password', async function(req, res, next) {
	res.render('users/password');
});

/**
 * POST /password (email:string)
 * Sends a password reset email if a user account exists for that email.
 * The password reset expires in 30 minutes.
 */
router.post('/password', [

	body('email').trim().isLength({min:1}).withMessage('Please enter your email address').bail()
		.isEmail().withMessage('Invalid email address'),

	async function(req, res, next) {

		const errors = validationResult(req).array();

		if(errors.length > 0) {
			res.render('users/password', { errors })
			return;
		}

		var email = req.body.email;
		var user = await User.findOne({where: { email }});

		req.session.passwordResetEmail = email;
		if(user) {
			await sendForgotPasswordEmail(req, user)
		}

		res.redirect('password-reset-sent');
	}]
);

/**
 * GET users/password-reset-sent
 * The page shown after a password reset has been sent.
 */
router.get('/password-reset-sent', async function(req, res, next) {
	res.render('users/password-reset-sent', { email: req.session.passwordResetEmail });
});

/**
 * POST /users/resend-password-reset
 * Resends the password reset email.
 * TODO: rate-limit requests (e.g. one per minute, increasing for each email sent) to make sure this isn't abused.
 */
 router.post('/resend-password-reset', async function(req, res, next) {
	var email = req.session.passwordResetEmail;
	var user = await User.findOne({ where: { email } });
	if(user) {
		await sendForgotPasswordEmail(req, user);
	}
	res.send('Sent');
});

function getValidOneTimeCode(redirect) {
	return async function(req, res, next) {
		var code = req.params.code;
		var oneTimeCode = await OneTimeCode.findOne({ where: { code: code }});

		if(!oneTimeCode) {
			req.flash.alert = 'Invalid link. Please try again.';
			res.redirect(redirect);
			return;
		} else if(oneTimeCode.expires < new Date()) {
			req.flash.alert = 'The link you followed has expired. Please try again.';
			res.redirect(redirect);
			return;
		} else if(oneTimeCode.used != null) {
			req.flash.alert = 'This link has already been used.'
			res.redirect(redirect);
			return;
		}

		res.locals.oneTimeCode = oneTimeCode;
		next();
	}
}

/**
 * GET /users/reset-password/:code
 * Shows the form for a user to reset their password.
 */
router.get('/reset-password/:code', getValidOneTimeCode('/users/password'), async function(req, res, next) {
	var passwordReset = res.locals.oneTimeCode;
	var email = passwordReset.email;

	res.render('users/reset-password', { email });
});

/**
 * POST /users/reset-password/:code (newPassword:string)
 * Resets the user's password.
 */
router.post('/reset-password/:code',
getValidOneTimeCode('/users/password'),
body('password').trim().isLength({ min: 8 }).withMessage('Password must be 8 characters or longer')
	.custom((value) => /[A-Z]/.test(value)).withMessage('Password must contain at least one uppercase letter')
	.custom((value) => /[a-z]/.test(value)).withMessage('Password must contain at least one lowercase letter'),
async function(req, res, next) {
	const errors = validationResult(req);
	if(!errors.isEmpty()) {
		res.render('users/reset-password', { errors: errors.mapped() });
		return;
	}

	var passwordReset = res.locals.oneTimeCode;
	
	var user = await User.findByPk(passwordReset.userId);

	var password = req.body.password;

	user.set({ password: auth.hashPassword(password)});
	await user.save();

	req.flash.notice = "Your password was successfully reset. Please log in."

	res.redirect('/users/login');
});

/**
 * GET /users/signup
 * 
 * Displays the sign up page.
 */
router.get('/signup', function(req, res, next) {
	const inviteCode = req.query.invite
	res.render('users/signup', { inviteCode });
});

/**
 * Send an activation email to the supplied email address
 * @param {Request} req - The HTTP request
 * @param {string} email - The email address to send the activation message to.
 */
async function sendActivationEmail(req, user) {

	// Send activation email, including req.query.continue if necessary
	var code = auth.oneTimeCode(10);
	const expireInDays = 3;
	var expires = new Date((new Date()).getTime() + expireInDays * 24 * 60 * 60 * 1000);
	await OneTimeCode.create({ userId: user.id, email: user.email, code, expires });

	var protocol = req.app.get('env') == 'production' ? 'https' : 'http';
	var link = `${protocol}://${req.headers.host}/users/activate/${code}`

	let qs = [];
	// Check for a continue parameter that's expected, rather than just
	// allow whatever was in the querystring
	if(req.query.continue == 'creator') {
		qs.push('continue=creator');
	} else if(req.query.continue == 'supporter') {
		qs.push('continue=supporter');
	}
	if(req.query.invite) {
		qs.push('invite=' + req.query.invite);
	}
	if(qs.length) {
		link += '?' + qs.join('&');
	}
	await email.send(req.app.get('env'), {
		from: 'noreply@becomepluribus.com',
		to: user.email,
		subject: 'Pluribus Sign Up',
		text: `Please click the following link to activate your Pluribus account:\r\n
${link}`
	});
}

/**
 * Sends a password reset email.
 * The link expires in 30 minutes.
 */
async function sendForgotPasswordEmail(req, user) {
	// Note: this may be sent from the forgotten password page OR when
	// someone tries to sign up using an email address for an existing user account.
	// So we try to cover these two cases in the wording of th email, noting that
	// the request may have originated with someone else probing email addresses (hopefully rarely).
	var code = auth.oneTimeCode(10);
	const expireInMinutes = 30;
	var expires = new Date((new Date()).getTime() + expireInMinutes * 60000);
	await OneTimeCode.create({ userId: user.id, email: user.email, code, expires });

	var protocol = req.app.get('env') == 'production' ? 'https' : 'http';

	var info = await email.send(req.app.get('env'), {
		from: 'noreply@becomepluribus.com',
		to: user.email,
		subject: 'Reset your Pluribus password',
		text: `It looks like you've been having trouble accessing your Pluribus account.

Please click the following link to reset your Pluribus password:

${protocol}://${req.headers.host}/users/reset-password/${code}

If you did not make this request, please disregard this email.`
	});
}

/**
 * POST /users/signup(email:string,agree:boolean)
 * 
 * Creates an inactive user account and sends an activation email to the email address supplied.
 */
 router.post('/signup',
 	body('email')
	 	.trim().isLength({ min: 1}).withMessage('Please enter your email address').bail()
		.isEmail().withMessage('Invalid email address'),
	async function(req, res, next) {
		var errors = validationResult(req);

		if(!errors.isEmpty()) {
			res.render('users/signup', { errors });
			return;
		}

		var email = req.body.email;

		var existingUser = await User.findOne({where: { email }});

		if(existingUser) {
			// Perhaps they forgot that they already have an account
			await sendForgotPasswordEmail(req, existingUser);
		} else {
			var user = await User.create({ email });
			await sendActivationEmail(req, user);
		}

		req.session.signupEmail = email;
		res.redirect('/users/activate-sent');
	}
);

/**
 * GET /users/activate-sent
 * Shows the screen after a user submits the sign up form.
 */
router.get('/activate-sent', function(req, res, next) {
	var email = req.session.signupEmail;
	res.render('users/activate-sent', { email });
});

/**
 * POST /users/resend-activate
 * Resends the activation email.
 * TODO: rate-limit requests (e.g. one per minute, increasing for each email sent) to make sure this isn't abused.
 */
router.post('/resend-activate', async function(req, res, next) {
	var email = req.session.signupEmail;
	var user = await User.findOne({ where: { email } });
	if(user) {
		await sendActivationEmail(req, user);
	}
	res.send('Sent');
});

/**
 * GET /users/activate/:code
 * Shows the page for when a user clicks the activation link in their sign up email.
 */
router.get('/activate/:code', getValidOneTimeCode('/users/signup'), async function(req, res, next) {
	var activationCode = res.locals.oneTimeCode;
	var email = activationCode.email;

	res.render('users/activate', { email });
});

/**
 * POST /users/activate/:code(password:string,accept:boolean)
 * Activates the user account using the POSTed password.
 */
router.post('/activate/:code',
	getValidOneTimeCode('/users/signup'),
	body('password').trim().isLength({ min: 8 }).withMessage('Password must be 8 characters or longer'),
	body('accept').equals('yes').withMessage('Please accept our terms of service'),
	async function(req, res, next) {
		const errors = validationResult(req);
		if(!errors.isEmpty()) {
			res.render('users/activate', { errors: errors.mapped() });
			return;
		}

		var activationCode = res.locals.oneTimeCode;
		
		var user = await User.findByPk(activationCode.userId);

		var password = req.body.password;

		user.set({ password: auth.hashPassword(password)});
		await user.save();
		activationCode.used = new Date();
		await activationCode.save();

		req.flash.notice = "You have successfully activated your account. Welcome to Pluribus!";

		// Save authentication cookie
		req.session.authUser = { id: user.id, email: user.email, name: user.name, roles: [ ] };

		var redirect = '/users/choose-path';

		if(req.query.continue == 'creator') {
			redirect = '/creators/new';
		} else if(req.query.continue == 'supporter') {
			redirect = '/supporters/new';
		} else if(req.query.invite) {
			redirect = '/supporters/new?invite=' + req.query.invite;
		}

		res.redirect(redirect);
	});

router.get('/choose-path', auth.authorize, async function(req, res, next) {
	// Clear previous signup session
	req.session.creatorSignup = null;

	res.render('users/choose-path');
});
	

module.exports = router;
