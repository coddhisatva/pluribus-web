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

/* POST /login (email:string, password:string) */
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

		// Save authentication cookie
		req.session.authUser = { id: user.id, email: user.email };

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
 * GET /home
 */
router.get('/home', auth.authorize, async function(req, res, next) {
	var user = await User.findByPk(req.authUser.id);
	var following = await Follow.findAll({ where: { userId: user.id }, include: Creator });
	console.log(following);

	res.render('users/home', { user, following });
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

async function getValidPasswordReset(req, res, next) {
	var code = req.params.code;
	var passwordReset = await OneTimeCode.findOne({ where: { code: code }});

	if(!passwordReset) {
		req.flash.alert = 'Invalid link. Please try again.';
		res.redirect('/users/password');
		return;
	} else if(passwordReset.expires < new Date()) {
		req.flash.alert = 'The link you followed has expired. Please try again.';
		res.redirect('/users/password');
		return;
	}

	res.locals.passwordReset = passwordReset;
	next();
}

/**
 * GET /users/reset-password/:code
 * Shows the form for a user to reset their password.
 */
router.get('/reset-password/:code', getValidPasswordReset, async function(req, res, next) {
	var passwordReset = res.locals.passwordReset;

	res.render('users/reset-password');
});

/**
 * POST /users/reset-password/:code (newPassword:string)
 * Resets the user's password.
 */
router.post('/reset-password/:code',
getValidPasswordReset,
body('password').trim().isLength({ min: 4 }).withMessage('Password must be 4 characters or longer.'),
async function(req, res, next) {
	const errors = validationResult(req);
	if(!errors.isEmpty()) {
		res.render('users/reset-password', { errors: errors.mapped() });
		return;
	}

	var passwordReset = res.locals.passwordReset;
	
	var user = await User.findByPk(passwordReset.userId);

	var password = req.body.password;

	user.set({ password: auth.hashPassword(password)});
	await user.save();

	req.flash.notice = "Your password was successfully reset. Please log in."

	res.redirect('/users/login');
});

/**
 * GET /users/register
 */
router.get('/register', function(req, res, next) {
	res.render('users/register', { });
});

/**
 * POST /users/register(email:string,password:string)
 */
 router.post('/register',
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
	body('password')
		.trim().isLength({ min: 6}).withMessage('Password must be at least 6 characters long'),
	async function(req, res, next) {
		var errors = validationResult(req);

		if(!errors.isEmpty()) {
			res.render('users/register', { errors });
			return;
		}

		var email = req.body.email;
		var password = req.body.password;
		var user = await User.create({ email, password: auth.hashPassword(password) });

		// TODO: verify email

		// Save authentication cookie
		req.session.authUser = { id: user.id, email: user.email };
		
		req.flash.notice = 'Welcome to Pluribus!';

		return res.redirect('/users/home');
	}
);

module.exports = router;
