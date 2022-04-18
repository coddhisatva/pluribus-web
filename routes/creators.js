const express = require('express');
const router = express.Router();
const { Creator, User, Follow } = require('../models');
const { body, validationResult } = require('express-validator');
const auth = require('../utils/auth');

router.get('/', async function(req, res, next) {
	var creators = await Creator.findAll();
	res.render('creators/index', { creators });
});

async function ensureNoCreatorAccount(req, res, next) {
	// If there's no logged in user, redirect to user registration
	// with continue=creator
	if(res.locals.authUser == null) {
		res.redirect('/users/signup?continue=creator');
		return;
	}

	var creator = await Creator.findOne({ where: { userId: res.locals.authUser.id }});
	if(creator) {
		req.flash.alert = 'You already have a creator profile.';
		res.redirect('/dashboard');
		return;
	}

	next();
}

router.get('/new', ensureNoCreatorAccount, async function(req, res, next) {
	res.redirect('/creators/new/categories');
});

router.get('/new/categories', ensureNoCreatorAccount, async function(req, res, next) {
	res.render('creators/new-categories');
});

router.post('/new/categories',
	ensureNoCreatorAccount,
	async function(req, res, next) {
		if(!req.session.creatorSignup) {
			req.session.creatorSignup = { };
		}
		req.session.creatorSignup.categories = req.body.categories;
		res.redirect('/creators/new/details');
	}
);

router.get('/new/details', ensureNoCreatorAccount, async function(req, res, next) {
	res.render('creators/new-details', { });
});

router.post('/new/details',
	ensureNoCreatorAccount,
	body('name').trim().isLength({ min: 1 }).withMessage('Please enter your name'),
	body('about').trim().isLength({ min: 20 }).withMessage('Please write a bit more about yourself'),
	async function(req, res, next) {
		var errors = validationResult(req);
		if(!errors.isEmpty()) {
			res.render('creators/new-details', { errors });
			return;
		}
		
		var name = req.body.name;
		var about = req.body.about;
		var userId = res.locals.authUser.id;
		var displaySupporterCount = true; // default

		var creator = await Creator.create({ name, about, userId, displaySupporterCount });

		req.flash.notice = 'You\'re now set up as a creator.';

		req.session.authUser.isCreator = true;

		res.redirect('/dashboard/profile');
	}
);

router.get('/:id', async function(req, res, next) {
	var creator = await Creator.findByPk(req.params.id, { include: User });

	var isFollowing = false;
	if(req.authUser) {
		var follow = await Follow.findOne({ where: { userId: req.authUser.id, creatorId: creator.id } });
		if(follow !== null) {
			isFollowing = true;
		} 
	}
	res.render('creators/show', { creator, isFollowing });
});

/**
 * POST /:id/follow
 * Sets the authenticated user to follow the creator specified by :id.
 */
router.post('/:id/follow', auth.authorize, async function(req, res, next) {
	var creatorId = req.params.id;
	var userId = res.locals.authUser.id;
	await Follow.create({ creatorId,  userId });

	res.sendStatus(200);
});

/**
 * POST /:id/unfollow
 * Sets the authenticated user to NOT follow the creator specified by :id.
 */
 router.post('/:id/unfollow', auth.authorize, async function(req, res, next) {
	var creatorId = req.params.id;
	var userId = res.locals.authUser.id;
	var follow = await Follow.findOne({ where: { creatorId, userId }});
	if(follow) {
		await follow.destroy();
	}

	res.sendStatus(200);
});

module.exports = router;