const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../utils/auth');
const { User } = require('../models');

/* GET /login */
router.get('/login', function(req, res, next) {
	res.render('users/login', { title: 'Login' });
});

/* POST /login */
router.post('/login', [
	body('email').trim().isLength({min:1}).withMessage('Email is required').bail()
		.isEmail().withMessage('Invalid email address'),
	body('password', 'Please enter your password').trim().isLength({min:1}),

	async function(req, res, next) {
		const errors = validationResult(req).array();

		var user;
		if(errors.length == 0) {
			user = await User.findOne({ where: { email: req.body.email }});
			if(!auth.verifyPassword(req.body.password, user.password)) {
				errors.push({ msg: 'Invalid password', param: 'password' });
			}
		}

		if(errors.length > 0) {
			res.render('users/login', { title: 'Login', errors: errors })
			return;
		}

		// Save authentication cookie
		req.session.authUser = { id: user.id, email: user.email };

		var redirect = req.query.redirect;
		if(redirect) {
			res.redirect(redirect);
		} else {
			res.redirect('/');
		}
	}
]);

// GET /logout
router.get('/logout', async function(req, res, next) {
	req.session.authUser = null;
	res.redirect('/');
});

module.exports = router;
