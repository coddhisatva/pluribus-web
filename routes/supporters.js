const express = require('express');
const router = express.Router();
const { User, UserInterest } = require('../models');
const { body, validationResult } = require('express-validator');
const auth = require('../utils/auth');
const { ResultWithContext } = require('express-validator/src/chain');
const handleAsyncErrors = require('../utils/handleAsyncErrors');

async function ensureUser(req, res, next) {
	// If there's no logged in user, redirect to user registration
	// with continue=supporter
	if(res.locals.authUser == null) {
		res.redirect('/users/signup?continue=supporter');
		return;
	}

	next();
}

router.get('/new', ensureUser, handleAsyncErrors(async function(req, res, next) {
	var redirect = '/supporters/new/interests';
	if(req.query.invite) {
		redirect += '?invite=' + req.query.invite;
	}
	res.redirect(redirect);
}));

router.get('/new/interests', ensureUser, handleAsyncErrors(async function(req, res, next) {
	let interests = await UserInterest.findAll({ where: { userId: req.authUser.id }});
	interests = interests.map(i => i.interest);
	res.render('supporters/new-interests', { interests });
}));

router.post('/new/interests',
	ensureUser,
	handleAsyncErrors(async function(req, res, next) {
		let interests = Array.isArray(req.body.interests) ?
			req.body.interests : [req.body.interests];

		await UserInterest.destroy({ where: { userId: req.authUser.id }});
		for(let interest of interests) {
			await UserInterest.create({ userId: req.authUser.id, interest });
		}

		var redirect = '/supporters/new/name';
		if(req.query.invite) {
			redirect += '?invite=' + req.query.invite;
		}
		res.redirect(redirect);
	}
));

router.get('/new/name', ensureUser, handleAsyncErrors(async function(req, res) {
	let user = await User.findOne({ where: { id: req.authUser.id }});
	res.render('supporters/new-name', { name: user.name });
}));

router.post('/new/name',
	ensureUser,
	body('name').trim().isLength({ min: 1 }).withMessage('Please enter your name'),
	handleAsyncErrors(async function(req, res, next) {
		if(!req.body.skip) {
			var errors = validationResult(req);
			if(!errors.isEmpty()) {
				res.render('supporters/new-name', { errors });
				return;
			}

			await User.update(
				{ name: req.body.name },
				{ where: { id: req.authUser.id }})
		}
		
		req.flash.notice = 'You\'re now set up as a supporter.';
		req.session.name = req.body.name;

		var redirect = '/dashboard';
		if(req.query.invite) {
			// Note: invite codes may contain '/' characters, so we need to encode them
			redirect = '/invite/' + encodeURIComponent(req.query.invite);
		}
		res.redirect(redirect);
	}
));

module.exports = router;