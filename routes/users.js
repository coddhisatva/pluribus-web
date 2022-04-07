const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../utils/auth');
const { User, Follow, Creator, OneTimeCode } = require('../models');
const nodemailer = require('nodemailer');
const emailConfig = require('../config/email');
const { localsName } = require('ejs');

/* GET /login */
router.get('/login', function(req, res, next) {
	res.render('users/login');
});

/* POST /login (email:string, password:string, remember:1) */
router.post('/login', [
	body('email').trim().isLength({min:1}).withMessage('Email is required').bail()
		.isEmail().withMessage('Invalid email address'),
	body('password', 'Please enter your password').trim().isLength({min:1}),

	async function(req, res, next) {
		const errors = validationResult(req).array();

		var user;
		if(errors.length == 0) {
			user = await User.findOne({ where: { email: req.body.email }});
			if(!user) {
				errors.push({ msg: 'Unknown user', param: 'email' });
			} else if(!auth.verifyPassword(req.body.password, user.password)) {
				errors.push({ msg: 'Invalid password', param: 'password' });
			}
		}

		if(errors.length > 0) {
			res.render('users/login', { errors: errors })
			return;
		}

		var remember = req.body.remember == '1';

		// Save authentication cookie
		req.session.authUser = { id: user.id, email: user.email };
		if(remember) {
			req.sessionOptions.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
		}

		req.flash.notice = "Welcome back!";

		var redirect = req.query.redirect;
		if(redirect) {
			res.redirect(redirect);
		} else {
			res.redirect('/');
		}
	}
]);

/**
 * GET /logout
 */
router.get('/logout', async function(req, res, next) {
	req.session.authUser = null;
	req.flash.notice = 'You\'ve been logged out.';
	res.redirect('/');
});

/**
 * GET /dashboard
 */
router.get('/dashboard', auth.authorize, async function(req, res, next) {
	var user = await User.findByPk(req.authUser.id);
	var following = await Follow.findAll({ where: { userId: user.id }, include: Creator });
	console.log(following);

	res.render('users/dashboard', { user, following });
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
		const expireInMinutes = 30;

		const errors = validationResult(req).array();

		if(errors.length > 0) {
			res.render('users/password', { errors })
			return;
		}

		var email = req.body.email;
		var user = await User.findOne({where: { email }});
		if(user) {
			var code = auth.oneTimeCode(10);
			var expires = new Date((new Date()).getTime() + expireInMinutes * 60000);
			await OneTimeCode.create({ userId: user.id, email, code, expires });

			var emailer = nodemailer.createTransport(emailConfig[req.app.get('env')]);
			var info = await emailer.sendMail({
				from: 'noreply@pluribusworkspace',
				to: user.email,
				subject: 'Reset your Pluribus password',
				text: `Please click the following link to reset your Pluribus password:\n
${req.protocol}://${req.headers.host}/users/reset-password/${code}`
			})
		}

		res.redirect('password-reset-sent');
	}]
);

/**
 * GET users/password-reset-sent
 * The page shown after a password reset has been sent.
 */
router.get('/password-reset-sent', async function(req, res, next) {
	res.render('users/password-reset-sent');
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

	res.render('users/reset-password');
});

/**
 * POST /users/reset-password/:code (newPassword:string)
 * Resets the user's password.
 */
router.post('/reset-password/:code',
getValidOneTimeCode('/users/password'),
body('password').trim().isLength({ min: 4 }).withMessage('Password must be 4 characters or longer.'),
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
	res.render('users/signup', { });
});

/**
 * Send an activation email to the supplied email address
 * @param {Request} req - The HTTP request
 * @param {string} email - The email address to send the activation message to.
 */
async function sendActivationEmail(req, email) {
	var user = await User.findOne({where: { email }});
	if(user && user.password != null) return; // user already active

	if(!user) {
		user = await User.create({ email });
	}

	// Send activation email, including req.query.continue if necessary
	var code = auth.oneTimeCode(10);
	const expireInDays = 3;
	var expires = new Date((new Date()).getTime() + expireInDays * 24 * 60 * 60 * 1000);
	await OneTimeCode.create({ userId: user.id, email, code, expires });

	var emailer = nodemailer.createTransport(emailConfig[req.app.get('env')]);

	var link = `${req.protocol}://${req.headers.host}/users/activate/${code}`
	// Check for a continue parameter that's expected, rather than just
	// allow whatever was in the querystring
	if(req.query.continue == 'creator') {
		link += '?continue=creator';
	}
	var info = await emailer.sendMail({
		from: 'noreply@pluribusworkspace',
		to: user.email,
		subject: 'Pluribus Sign Up',
		text: `Please click the following link to activate your Pluribus account:\r\n
${link}`
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
		.isEmail().withMessage('Invalid email address')
		.custom(value => {
			return User.findOne({where: { email: value }}).then(user => {
				if(user) {
					return Promise.reject('E-mail already in use');
				}
			});
		}),
	body('agree')
		.equals('yes').withMessage('You must agree to the terms and conditions'),
	async function(req, res, next) {
		var errors = validationResult(req);

		if(!errors.isEmpty()) {
			res.render('users/signup', { errors });
			return;
		}

		var email = req.body.email;
		await sendActivationEmail(req, email);

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
	await sendActivationEmail(req, email);
	res.json({ });
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

		req.flash.notice = "You have successfully activated your account. Welcome to Pluribus!";

		// Save authentication cookie
		req.session.authUser = { id: user.id, email: user.email };

		res.redirect('/users/dashboard');
	});
	

module.exports = router;
