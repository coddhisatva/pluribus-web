const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../utils/auth');
const { sequelize, User, Creator, Follow, CardPaymentMethod, Pledge, PolicyExecution, PolicyExecutionSupporter } = require('../models');
const mysql = require('mysql2');
const multer = require('multer');
const upload = multer({ dest: 'uploads/tmp' });
const fs = require('fs/promises');
const path = require('path');
const util = require('../utils/util');
const sharp = require('sharp');
const { serialize } = require('v8');
const credentials = require('../config/credentials');
const crypto = require('crypto');
const creator = require('../models/creator');

router.get('/', auth.authorize, async function(req, res, next) {
	var user = await User.findByPk(req.authUser.id);
	var creator = await Creator.findOne({ where: { userId: user.id }});
	var following = await Follow.findAll({ where: { userId: user.id }, include: Creator });

	var executed = await PolicyExecutionSupporter.findAll({ where: { userId: user.id, agree: null }, include: { model: PolicyExecution, include: Creator } });

	res.render('dashboard/index', { user, creator, following, executed });
});

router.get('/profile', auth.authorizeRole('creator'), async function(req, res, next) {
	var user = await User.findByPk(req.authUser.id);
	var creator = await Creator.findOne({ where: { userId: user.id }});
	if(!creator) {
		res.status(404).send("Creator not found.");
		return;
	}

	var inviteBase = req.protocol + '://' + req.headers.host + '/invite/';

	res.render('dashboard/profile', { user, creator, inviteBase });
});
router.post('/profile', auth.authorizeRole('creator'), upload.single('newPhoto'), async function(req, res, next) {
	var user = await User.findByPk(req.authUser.id);
	var creator = await Creator.findOne({ where: { userId: user.id }});

	// These are value we need to send back to the client. Only send
	// values that the client wouldn't otherwise know about.
	var sync = { };

	var update = { };
	['name', 'about', 'website', 'displaySupporterCount', 'publicProfile' ].forEach(prop => {
		var value = req.body[prop];

		if(value !== undefined) {
			if(Creator.tableAttributes[prop].type.key == 'BOOLEAN') {
				// For check boxes, any string equals true
				update[prop] = !!value;
			} else {
				update[prop] = value;
			}
		}
	});

	if(req.file) {
		var dir = 'public/images/uploads/creators/' + creator.id;
		var filename = path.basename(req.file.path);
		var ext = util.mimeTypeExtensions[req.file.mimetype];
		if(!ext) {
			throw 'Mime type not implemented: ' + req.file.mimetype;
		}
		filename += ext;
		await fs.mkdir(dir, { recursive: true });
		var sharpResult = await sharp(req.file.path)
			.resize({ width: 200, height: 200})
			.toFile(dir + '/' + filename);

		await fs.rm(req.file.path);
		update.photo = filename;
		sync.photo = filename;
		sync.newPhoto = ''; // a little hacky, but tell the view to reset the newPhoto file input
	}

	if(req.body.removeExistingPhoto && creator.photo) {
		var photoPath = 'public/images/uploads/creators/' + creator.id + '/' + creator.photo;
		await fs.rm(photoPath, { force: true }); // force ignores exceptions if file doesn't exist
		update.photo = null;
	}

	// Social profiles are passed in using pseudo properties from client and need to
	// be recombined into the .socialProfiles property.
	const socialProfileFns = {
		twitter: {
			parse: (value) => {
				var m = /^\s*(?:https?:\/\/)?twitter.com\/([a-z0-9_]+)/i.exec(value);
				if(m) return m[1];
				m = /^\s*([a-z0-9_]+)\s*$/i.exec(value);
				if(m) return m[1];
				return null;
			},
			format: value => 'https://twitter.com/' + value
		},
		youtube: {
			// TODO: we need to handle these formats
			// https://www.youtube.com/@CoryWongMusic ✅
			// https://www.youtube.com/user/CoryWongMusic ✅
			// https://www.youtube.com/c/CoryWongMusic ✅
			// https://www.youtube.com/c/CoryWongMusic/videos
			// https://www.youtube.com/CoryWongMusic 
			// https://www.youtube.com/channel/UCQqC08JWnJGJIgw43XJ0GXw
			
			parse: (value) => {
				var m = /^\s*(?:https?:\/\/)?(?:www\.)?youtube.com\/(?:user\/|c\/|@)(\w+)/i.exec(value);
				if(m) return m[1];
				m = /^\s*(\w+)\s*$/i.exec(value);
				if(m) return m[1];
				return null;
			},
			format: (value) => 'https://youtube.com/@' + value
		},
		instagram: {
			parse: (value) => {
				var m = /^\s*(?:https?:\/\/)?(?:www\.)?instagram.com\/([a-z0-9_]+)/i.exec(value);
				if(m) return m[1];
				m = /^\s*([a-z0-9_]+)\s*$/i.exec(value);
				if(m) return m[1];
				return null;
			},
			format: value => 'https://instagram.com/' + value
		},
		substack: {
			parse: (value) => {
				var m = /^\s*(?:https?:\/\/)?([a-z0-9\-_]+.substack.com)/i.exec(value);
				if(m) return m[1];
				return null;
			},
			format: (value) => 'https://' + value
		}
	};
	var socialProfiles = [];
	var hasSocialProfilesUpdates = false;

	for(var key in socialProfileFns) {
		var value = req.body['socialProfiles_' + key];
		if(value !== undefined) {
			hasSocialProfilesUpdates = true;
			var fns = socialProfileFns[key];
			var parsed = fns.parse(value);
			if(parsed) {
				socialProfiles.push(fns.format(parsed));
			}
		}
	}
	if(hasSocialProfilesUpdates) {
		update.socialProfiles = socialProfiles.join('||');
		sync.socialProfiles = update.socialProfiles;
	}
	
	await Creator.update(update, { where: { id: creator.id }});

	res.send(sync);
});

router.get('/payments', auth.authorize, async function(req, res, next) {
	var stripePublicKey = credentials.stripe.publicKey;

	var user = await User.findByPk(req.authUser.id);
	var creator = await Creator.findOne({ where: { userId: user.id }});
	
	var cardPaymentMethods = await CardPaymentMethod.findAll({ where: { userId: req.authUser.id }});
	var primaryCardPaymentMethod = cardPaymentMethods.find(method => method.id == user.primaryCardPaymentMethodId);

	res.render('dashboard/payments', { user, creator, stripePublicKey, cardPaymentMethods, primaryCardPaymentMethod });
});

/**
 * POST /dashboard/payments/beginAddCreditCard
 * Called before adding a credit card payment method for a user to setup Stripe custom integration.
 * https://stripe.com/docs/payments/save-and-reuse?platform=web
 */
router.post('/payments/beginAddCreditCard', auth.authorize, async function(req, res, next) {
	const stripe = require('stripe')(credentials.stripe.secretKey);
	var user = await User.findByPk(req.authUser.id);

	// Ensure we have a Stripe customer for this user.
	if(!user.stripeCustomerId) {
		const customer = await stripe.customers.create();
		user.stripeCustomerId = customer.id;
		await User.update({ stripeCustomerId: user.stripeCustomerId }, { where: { id: user.id } });
	}

	// Create a SetupIntent
	const setupIntent = await stripe.setupIntents.create({
		customer: user.stripeCustomerId,
		payment_method_types: [ 'card' ]
	});

	res.json({ clientSecret: setupIntent.client_secret });

});

router.get('/payments/card-added', auth.authorize, async function(req, res, next) {
	const stripe = require('stripe')(credentials.stripe.secretKey);

	var setupIntentId = req.query.setup_intent;

	var setupIntent = await stripe.setupIntents.retrieve(setupIntentId, {
		expand: [ 'payment_method' ]
	});

	var user = await User.findByPk(req.authUser.id);

	var cardPaymentMethod = await CardPaymentMethod.create({
		userId: user.id,
		stripePaymentMethodId: setupIntent.payment_method.id,
		cardType: setupIntent.payment_method.card.brand,
		last4: setupIntent.payment_method.card.last4,
		expMonth: setupIntent.payment_method.card.exp_month,
		expYear: setupIntent.payment_method.card.exp_year,
		nickname: setupIntent.payment_method.metadata.nickname,
		firstName: setupIntent.payment_method.metadata.firstName,
		lastName: setupIntent.payment_method.metadata.lastName
	});

	// Select the payment method
	await User.update({ primaryCardPaymentMethodId: cardPaymentMethod.id }, { where: { id: user.id } });
	
	req.flash.notice = "Card was added successfully";

	if(req.query.pledge) {
		// Redirect back to creator pledge
		const creatorId = req.query.pledge;
		const amount = req.query.amount;
		const frequency = req.query.frequency;
		res.redirect('/creators/' + creatorId + '/pledge?amount=' + amount + '&frequency=' + frequency);
		return;
	}
	res.redirect('/dashboard/payments');
});

router.post('/payments/set-primary-method', auth.authorize, async function(req, res, next) {
	var user = await User.findByPk(req.authUser.id);

	var methodId = req.body.id;
	var cardPaymentMethod = await CardPaymentMethod.findOne({ where: { id: methodId, userId: user.id } });
	if(cardPaymentMethod) {
		var primaryCardPaymentMethodId = methodId;
		await User.update({ primaryCardPaymentMethodId }, { where: { id : user.id }});
		req.flash.notice = "Primary payment method was changed successfully";
	} else {
		req.flash.alert = "Invalid payment method selected";
	}

	res.redirect('/dashboard/payments');
});

router.post('/payments/delete-payment-method', auth.authorize, async function(req, res, next) {
	var user = await User.findByPk(req.authUser.id);

	var methodId = req.body.id;
	if(methodId == user.primaryCardPaymentMethodId) {
		res.status(400).json({ error: "Can't delete the primary payment method"});
		return;
	}

	var cardPaymentMethod = await CardPaymentMethod.findOne({ where: { id: methodId, userId: user.id } });
	if(!cardPaymentMethod) {
		res.status(400).json({ error: "Payment method not found"});
		return;	
	}

	await cardPaymentMethod.destroy();
	res.status(200).json({ message: 'Card was removed successfully' });
});

router.get('/policy', auth.authorizeRole('creator'), async function(req, res, next) {
	var user = await User.findByPk(req.authUser.id);
	var creator = await Creator.findOne({ where: { userid: user.id }});
	res.render('dashboard/policy', { user, creator, policy: creator.policy });
});

router.post('/policy',
	auth.authorizeRole('creator'),
	body('policy').trim().isLength({ min: 20 }).withMessage('Please enter more text (20 character minimum)'),
	async function(req, res, next) {
		var errors = validationResult(req);
		if(!errors.isEmpty()) {
			res.status(400).json({ errors: errors.array() });
			return;
		}

		var user = await User.findByPk(req.authUser.id);
		var creator = await Creator.findOne({ where: { userid: user.id }});

		var policy = req.body.policy;
		creator.policy = policy;
		await creator.save();

		res.json({ result: "ok" });
	}
);

router.get('/execute-policy', auth.authorizeRole('creator'), async function(req, res, next) {
	const user = await User.findOne({ where: { id: req.authUser.id }});
	const creator = await Creator.findOne({ where: { userId: user.id }});

	// TODO: de-duplicate in all /execute-policy routes
	var active = await PolicyExecution.findAll({ where: { creatorId: creator.id, processedAt: null }});
	if(active && active.length) {
		res.send("You already have an active policy execution!");
		return;
	}

	res.redirect('/dashboard/execute-policy/1');
});

router.get('/execute-policy/1', auth.authorizeRole('creator'), async function(req, res, next) {
	const user = await User.findOne({ where: { id: req.authUser.id }});
	const creator = await Creator.findOne({ where: { userId: user.id }});

	// TODO: de-duplicate in all /execute-policy routes
	var active = await PolicyExecution.findAll({ where: { creatorId: creator.id, processedAt: null }});
	if(active && active.length) {
		res.send("You already have an active policy execution!");
		return;
	}

	res.render('dashboard/execute-policy-step1');
});
router.get('/execute-policy/2', auth.authorizeRole('creator'), async function(req, res, next) {
	const user = await User.findOne({ where: { id: req.authUser.id }});
	const creator = await Creator.findOne({ where: { userId: user.id }});

	// TODO: de-duplicate in all /execute-policy routes
	var active = await PolicyExecution.findAll({ where: { creatorId: creator.id, processedAt: null }});
	if(active && active.length) {
		res.send("You already have an active policy execution!");
		return;
	}

	res.render('dashboard/execute-policy-step2');
});
router.post('/execute-policy/3', auth.authorizeRole('creator'), async function(req, res, next) {
	const user = await User.findOne({ where: { id: req.authUser.id }});
	const creator = await Creator.findOne({ where: { userId: user.id }});

	// TODO: de-duplicate in all /execute-policy routes
	var active = await PolicyExecution.findAll({ where: { creatorId: creator.id, processedAt: null }});
	if(active && active.length) {
		res.send("You already have an active policy execution!");
		return;
	}

	const reason = req.body.reason;
	req.session.policyExecution = { reason };
	res.render('dashboard/execute-policy-step3', { reason, creator });
});

router.get('/execute-policy/executed', auth.authorizeRole('creator'), async function(req, res, next) {
	const user = await User.findOne({ where: { id: req.authUser.id }});
	const creator = await Creator.findOne({ where: { userId: user.id }});

	// TODO: de-duplicate in all /execute-policy routes
	var active = await PolicyExecution.findAll({ where: { creatorId: creator.id, processedAt: null }});
	if(active && active.length) {
		res.send("You already have an active policy execution!");
		return;
	}

	// Save the policy execution to DB
	const reason = req.session.policyExecution.reason;
	const executedAt = new Date();
	let execution = await PolicyExecution.create({ creatorId: creator.id, reason, executedAt });

	const pledges = await Pledge.findAll({ where: { creatorId: creator.id }});
	for await(pledge of pledges) {
		const executionSupporter = await PolicyExecutionSupporter.create({
			policyExecutionId: execution.id,
			userId: pledge.userId,
			pledgeId: pledge.id,
		});
	}

	// TODO: Notify supporters via email

	res.render('dashboard/execute-policy-executed');
});

router.post('/policy-execution-response/:id', auth.authorize, async (req, res) => {
	const response = req.body.response;

	const user = await User.findByPk(req.authUser.id);
	const policyExecution = await PolicyExecution.findByPk(req.params.id);
	if(!policyExecution) {
		res.status(404).send('Policy execution not found');
		return;
	}

	const policyExecutionSupporter = await PolicyExecutionSupporter.findOne({ where: { policyExecutionId: policyExecution.id, userId: user.id }});
	if(!policyExecutionSupporter) {
		res.status(404).send('You can not respond to this policy');
		return;
	}

	switch(response) {
		case 'agree':
			policyExecutionSupporter.agree = true;
			policyExecutionSupporter.respondedAt = new Date();
			await policyExecutionSupporter.save();
			res.render('dashboard/policy-execution-response-agreed');
			return;
		case 'disagree':
			policyExecutionSupporter.agree = false;
			policyExecutionSupporter.respondedAt = new Date();
			await policyExecutionSupporter.save();
			res.render('dashboard/policy-execution-response-disagreed');
			return;
		default:
			res.status(400).send('Invalid response');
			return;
	}
});

router.get('/security', async function(req, res, next) {
	var user = await User.findByPk(req.authUser.id);
	var creator = await Creator.findOne({ where: { userid: user.id }});
	res.locals.nav = 'security';
	res.render('coming-soon', { user, creator });
});

router.get('/settings', async function(req, res, next) {
	var user = await User.findByPk(req.authUser.id);
	var creator = await Creator.findOne({ where: { userid: user.id }});
	res.locals.nav = 'settings';
	res.render('coming-soon', { user, creator });
});

router.get('/referrals', async function(req, res, next) {
	var user = await User.findByPk(req.authUser.id);
	var creator = await Creator.findOne({ where: { userid: user.id }});
	res.locals.nav = 'referrals';
	res.render('coming-soon', { user, creator });
});

router.get('/search', async (req, res) => {
	let q = req.query['q'];
	let results = null;
	if(q) {
		var terms = q.split(' ');
		var whereClause = 'where publicProfile = 1 and (';
		for(var i = 0; i < terms.length; i++) {
			var term = terms[i].replace(/['"']/g, '\\$&');
			if(i > 0) { whereClause += ' or '};
			whereClause += "name like '%" + term + "%'";
		}
		whereClause += ')';
		[ results, metadata ] = await sequelize.query("select * from Creators " + whereClause);
		console.log(results);
	}

	res.render('dashboard/search', { results });
});

router.get('/pledges', auth.authorize, async (req, res) => {
	const user = await User.findByPk(req.authUser.id);
	const creator = await Creator.findOne({ where: { userid: user.id }});

	const pledgesMade = await Pledge.findAll({ where: { userId: user.id }, include: Creator });
	const pledgesReceived = creator ? await Pledge.findAll({ where: { creatorId: creator.id  }, include: User}) : null;

	res.render('dashboard/pledges', { creator, pledgesMade, pledgesReceived });
});

module.exports = router;