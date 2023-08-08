const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { sequelize, Creator, CreatorCategory, User, Follow, CardPaymentMethod, Pledge } = require('../models');
const { body, validationResult } = require('express-validator');
const auth = require('../utils/auth');
const csrf = require('../utils/csrf');
const email = require('../utils/email');
const credentials = require('../config/credentials');
require('../utils/handleAsyncErrors').fixRouter(router);

router.get('/', async function(req, res, next) {
	var creators = await Creator.findAll({ where: { publicProfile: true }});
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

		var about = req.session.creatorSignup?.about || '';
		var name = req.session.creatorSignup?.name || '';
		var publicProfile = req.session.creatorSignup?.publicProfile || false;
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
		var categories = (req.session.creatorSignup?.categories || []);
		for(category of categories) {
			await CreatorCategory.create({ creatorId: creator.id, category });
		}

		req.flash.notice = 'You\'re now set up as a creator.';

		req.session.authUser.roles.push('creator');

		res.redirect('/dashboard/profile');
	}
);

router.get('/:id', async function(req, res, next) {
	var creator = await Creator.findByPk(req.params.id, { include: [ User, CreatorCategory ] });
	if(!creator) {
		res.status(404).send('Creator not found.');
		return;
	}

	var isFollowing = false;
	var pledge = null;
	if(req.authUser && req.authUser.id) {
		var follow = await Follow.findOne({ where: { userId: req.authUser.id, creatorId: creator.id } });
		if(follow !== null) {
			isFollowing = true;
		} 

		pledge = await Pledge.findOne({ where: { creatorId: creator.id, userId: req.authUser.id }});
	}

	var followerCount = await Follow.count({ where: { creatorId: creator.id } });
	var pledgeSummary = (await sequelize.query('select count(amount) supporterCount, sum(amount) pledgeTotal from Pledges where creatorid = :creatorid',
		{ replacements: { creatorid: creator.id }, plain: true, raw: true }));

	var supporterCount = new Number(pledgeSummary.supporterCount);
	var pledgeTotal = new Number(pledgeSummary.pledgeTotal);

	// Don't let users view a Creator's private profile if they're not already following them
	if(!isFollowing && !creator.publicProfile) {
		res.status(403).send("This creator's profile is only visible to their followers.");
		return;
	}

	var creatorViewingOwnProfile = req.authUser && (creator.User.id == req.authUser.id);

	res.render('creators/show', { creator, isFollowing, followerCount, supporterCount, pledgeTotal, pledge, creatorViewingOwnProfile });
});

/**
 * POST /:id/follow
 * Sets the authenticated user to follow the creator specified by :id.
 */
router.post('/:id/follow', auth.authorize, async function(req, res, next) {
	var creatorId = req.params.id;
	var creator = await Creator.findByPk(creatorId, { include: User });

	// Don't let just anyone follow a private profile
	if(!creator.publicProfile) {
		let inviteCode = req.query.invite;
		let creator = inviteCode ? await Creator.findOne({ where: { inviteCode } }) : null;
		if(!creator) {
			res.sendStatus(404);
			return;
		}
	}

	var userId = res.locals.authUser.id;
	await Follow.create({ creatorId, userId });

	// Email notification
	var name = res.locals.authUser.name;
	if(!name) {
		// If the user has a creator account, use the creator's display name.
		var followerCreator = await Creator.findOne({ where: { userId: res.locals.authUser.id }});
		if(followerCreator) {
			name = followerCreator.name;
		}
	}

	email.send(req.app.get('env'), {
		from: 'noreply@becomepluribus.com',
		to: creator.User.email,
		subject: 'New follower on Pluribus',
		text: `You have a new follower on Pluribus:\r\n
${name || '(anonymous)'}`
	});

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

router.get('/:id/pledge', auth.authorize, async (req, res) => {
	var creator = await Creator.findByPk(req.params.id, { include: [ User, CreatorCategory ] });
	if(!creator) {
		res.status(404).send('Creator not found.');
		return;
	}

	if(!creator.stripeSubscriptionId) {
		req.flash.alert = "Creator must have a subscription to accept pledges.";
		res.redirect(creator.publicProfile ? '/creators/' + id : '/invite/' + encodeURIComponent(creator.inviteCode));
		return;
	}

	var user = await User.findByPk(req.authUser.id);

	var stripePublicKey = credentials.stripe.publicKey;

	var cardPaymentMethods = await CardPaymentMethod.findAll({ where: { userId: req.authUser.id }});
	var primaryCardPaymentMethod = cardPaymentMethods.find(method => method.id == user.primaryCardPaymentMethodId);

	res.render('creators/pledge', { creator, stripePublicKey, cardPaymentMethods, primaryCardPaymentMethod });
});

router.post('/:id/pledge', auth.authorize, csrf.validateToken, async(req, res) => {
	const userId = req.authUser.id;
	const creatorId = req.params.id;
	const creator = await Creator.findByPk(creatorId, { include: User });
	if(!creator) {
		res.status(400).send('Invalid pledge.');
		return;
	}

	if(!creator.stripeSubscriptionId) {
		req.flash.alert = "Creator must have a subscription to accept pledges.";
		res.redirect(creator.publicProfile ? '/creators/' + id : '/invite/' + encodeURIComponent(creator.inviteCode));
		return;
	}

	// Don't allow pledging to non-public profile unless the user follows this creator or they have an invite code
	if(!creator.publicProfile) {
		if(!req.query.invite || !req.query.invite == creator.inviteCode) {
			var follow = await Follow.findOne({ where: { userId, creatorId } });
			if(!follow) {
				res.status(400).send('Invalid pledge.');
				return;
			}
		}
	}

	// Note: DB constraint will disallow multiple pledges by a user to the same creator

	const frequency = 'once'; //req.body.frequency;
	const amount = Number(req.body.amount);

	switch(frequency) {
		case 'once':
			break;
		default:
			res.status(400).send('Invalid frequency: ' + frequency);
			return;
	}

	if(isNaN(amount) || amount < 5) {
		res.status(400).send('Invalid amount: ' + amount + '. Must be 5 or greater.');
		return;
	}

	try {
		await Pledge.create({
			userId,
			creatorId,
			frequency,
			amount
		});
	} catch(err) {
		if(err.name == "SequelizeUniqueConstraintError") {
			res.status(400).send('You have already pledged to this creator.');
			return;
		}
		throw err; // unexpected error
	}

	// Email notification
	var name = res.locals.authUser.name;
	if(!name) {
		// If the user has a creator account, use the creator's display name.
		var supporterCreator = await Creator.findOne({ where: { userId: res.locals.authUser.id }});
		if(supporterCreator) {
			name = supporterCreator.name;
		}
	}

	email.send(req.app.get('env'), {
		from: 'noreply@becomepluribus.com',
		to: creator.User.email,
		subject: 'New pledge on Pluribus',
		text: `You have a new pledge on Pluribus:\r\n
${name || '(anonymous)'} pledged $${amount}`
	});

	res.redirect('/creators/' + req.params.id + '/pledged');
});

router.get('/:id/pledged', auth.authorize, async(req, res) => {
	let creator = await Creator.findByPk(req.params.id);
	if(!creator) {
		res.status(404).send('Creator not found.');
	}
	res.render('creators/pledged', { creator });
});

module.exports = router;