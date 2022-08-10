const express = require('express');
const router = express.Router();
const { Creator, CreatorCategory, User, Follow } = require('../models');
const { body, validationResult } = require('express-validator');
const auth = require('../utils/auth');
const { ResultWithContext } = require('express-validator/src/chain');

router.get('/', async function(req, res, next) {
	var creators = await Creator.where({ publicProfile: true });
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
		req.session.creatorSignup.categories = Array.isArray(req.body.categories) ?
			req.body.categories : [req.body.categories];
		res.redirect('/creators/new/about');
	}
);

router.get('/new/about', ensureNoCreatorAccount, function(req, res, next) {
	res.render('creators/new-about');
});

router.post('/new/about',
	ensureNoCreatorAccount,
	body('about').trim().isLength({ min: 20 }).withMessage('Please write a bit more about yourself'),

	function(req, res, next) {
		var errors = validationResult(req);
		if(!req.body.skip) {
			if(!errors.isEmpty()) {
				res.render('creators/new-about', { errors });
				return;
			}
	
			req.session.creatorSignup.about = req.body.about;
		}
		
		res.redirect('/creators/new/name');
	}
);

router.get('/new/name', ensureNoCreatorAccount, function(req, res) {
	res.render('creators/new-name', { });
});

router.post('/new/name',
	ensureNoCreatorAccount,
	body('name').trim().isLength({ min: 1 }).withMessage('Please enter your name'),
	async function(req, res, next) {
		if(!req.body.skip) {
			var errors = validationResult(req);
			if(!errors.isEmpty()) {
				res.render('creators/new-name', { errors });
				return;
			}

			req.session.creatorSignup.name = req.body.name;
			req.session.creatorSignup.publicProfile = req.body.publicProfile == '1';
		}

		res.redirect('/creators/new/policy');
	}
);

router.get('/new/policy', ensureNoCreatorAccount, async function(req, res) {
	res.render('creators/new-policy', { });
});

router.post('/new/policy',
	ensureNoCreatorAccount,
	body('policy').trim().isLength({ min: 20 }).withMessage('Please enter more text (20 character minimum)'),
	async function(req, res, next) {

		var errors = validationResult(req);
		if(!errors.isEmpty()) {
			res.render('creators/new-policy', { errors });
			return;
		}

		var policy = req.body.policy;

		var about = req.session.creatorSignup.about || '';
		var name = req.session.creatorSignup.name || '';
		var publicProfile = req.session.creatorSignup.publicProfile || false;
		var userId = res.locals.authUser.id;
		var inviteCode = new Buffer.from(crypto.randomBytes(21)).toString('base64');

		var creator = await Creator.create({
			name,
			about,
			policy,
			userId,
			displaySupporterCount: true,
			publicProfile,
			inviteCode,
			hasPhoto: false
		});

		// Categories
		var categories = (req.session.creatorSignup.categories || []);
		for(category of categories) {
			await CreatorCategory.create({ creatorId: creator.id, category });
		}

		req.flash.notice = 'You\'re now set up as a creator.';

		req.session.authUser.roles.push('creator');

		res.redirect('/dashboard/profile');
	}
)

router.get('/:id', async function(req, res, next) {
	var creator = await Creator.findByPk(req.params.id, { include: User });
	if(!creator) {
		res.status(404).send('Creator not found.');
		return;
	}

	var isFollowing = false;
	if(req.authUser) {
		var follow = await Follow.findOne({ where: { userId: req.authUser.id, creatorId: creator.id } });
		if(follow !== null) {
			isFollowing = true;
		} 
	}

	// Don't let users view a Creator's private profile if they're not already following them
	if(!isFollowing && !creator.publicProfile) {
		res.status(404).send('Creator not found.');
		return;
	}

	res.render('creators/show', { creator, isFollowing });
});

/**
 * POST /:id/follow
 * Sets the authenticated user to follow the creator specified by :id.
 */
router.post('/:id/follow', auth.authorize, async function(req, res, next) {
	var creatorId = req.params.id;
	var creator = await Creator.findByPk(creatorId);

	// Don't allow just anyone to follow a private profile
	if(!creator.publicProfile) {
		res.sendStatus(404);
	}

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