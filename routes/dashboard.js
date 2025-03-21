const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../utils/auth');
const csrf = require('../utils/csrf');
const { sequelize, User, Creator, Follow, Guild, GuildCreator, GuildFollow, GuildPledge, CardPaymentMethod, Pledge, PolicyExecution, PolicyExecutionSupporter } = require('../models');
const { Op } = require('sequelize');
const multer = require('multer');
const upload = multer({ dest: 'uploads/tmp' });
const fs = require('fs/promises');
const path = require('path');
const util = require('../utils/util');
const email = require('../utils/email');
require('../utils/handleAsyncErrors').fixRouter(router);
const sharp = require('sharp');
const credentials = require('../config/credentials');
const settings = require('../config/settings');
const ejs = require('ejs');
const config = require('../config/credentials');
const nodemailer = require('nodemailer');

const POLICY_EXECUTION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds to match Stripe's payment hold limit

router.get('/', auth.authorize, async function(req, res, next) {
	const user = await User.findOne({
		where: { id: req.authUser.id }, 
		include: [
			{ model: Creator, required: false }, 
			{ model: Guild, required: false } ] });

	if (!user) {
		// User in session but not in DB - clear session and redirect to login
		req.session = null;
		return res.redirect('/users/login');
	}

	const creator = user.Creator;
	const guild = user.Guild;
	var following = await Follow.findAll({ where: { userId: user.id }, include: Creator });
	var guildFollowing = await GuildFollow.findAll({ where: { userId: user.id }, include: Guild });
	var executed = await PolicyExecutionSupporter.findAll({ 
		where: { 
			userId: user.id,
		},
		include: { 
			model: PolicyExecution,
			where: {
				expiresAt: {
					[Op.gt]: new Date()
				}
			},
			include: Creator 
		} 
	});

	res.render('dashboard/index', { user, creator, guild, following, guildFollowing, executed });
});

router.get('/profile', auth.authorizeRole('creator'), async function(req, res, next) {
	const user = await User.findByPk(req.authUser.id,
		{ include: [ { model: Creator, required: false }, { model: Guild, required: false } ] }   
	);
	const creator = user.Creator
	if(!creator) {
		res.status(404).send("Creator not found.");
		return;
	}

	const protocol = req.app.get('env') == 'production' ? 'https' : 'http';
	const inviteBase = `${protocol}://${req.headers.host}/invite/`;
	const profileLink = `${protocol}://${req.headers.host}/creators/${creator.id}`;
	
	res.render('dashboard/profile', { user, creator, inviteBase, profileLink }); 
});

// Social profiles are passed in using pseudo properties from client and need to
// be recombined into the .socialProfiles property.
const socialProfileFns = {
	twitter: {
		parse: (value) => {
			var m = /^\s*(?:https?:\/\/)?(?:twitter|x).com\/([a-z0-9_]+)/i.exec(value);
			if(m) return m[1];
			m = /^\s*([a-z0-9_]+)\s*$/i.exec(value);
			if(m) return m[1];
			return null;
		},
		format: value => 'https://x.com/' + value
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

router.post('/profile', auth.authorizeRole('creator'), upload.single('newPhoto'), async function(req, res, next) {
	var user = await User.findByPk(req.authUser.id);
	var creator = await Creator.findOne({ where: { userId: user.id }});

	// These are value we need to send back to the client. Only send
	// values that the client wouldn't otherwise know about.
	var sync = { };

	var update = { };
	['name', 'about', 'website', 'displaySupporterCount', 'displayPledgeTotal', 'publicProfile' ].forEach(prop => {
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

router.get('/guild', auth.authorizeRole('guildAdmin'), async function(req, res, next) { 
	const user = await User.findByPk(req.authUser.id,
		{ include: [ { model: Guild, required: false } ] }   
	);
	const guild = user.Guild
	if(!guild) {
		res.status(404).send("Guild not found.");
		return;
	}

	const protocol = req.app.get('env') == 'production' ? 'https' : 'http';
	const inviteBase = `${protocol}://${req.headers.host}/invite/`;
	let guildLink = `${protocol}://${req.headers.host}/guilds/${guild.id}`;
	res.render('dashboard/guild', { user, guild, inviteBase, guildLink }); 
});


router.post('/guild', auth.authorizeRole('guildAdmin'), upload.single('newGuildPhoto'), async function(req, res, next) {
	const user = await User.findByPk(req.authUser.id);
	const guild = await Guild.findOne({ where: { userId: user.id }});

	// These are value we need to send back to the client. Only send
	// values that the client wouldn't otherwise know about.
	const sync = { };
	const update = { };
	['name', 'about', 'website', 'displaySupporterCount', 'displayPledgeTotal', 'publicProfile' ].forEach(prop => {
		const formMap = {
			'displaySupporterCount': 'displayGuildSupporterCount',
			'displayPledgeTotal': 'displayGuildPledgeTotal',
			'publicProfile': 'publicGuild'
		};
		const value = req.body[formMap[prop] || prop];
		if(value !== undefined) {
			if(Guild.tableAttributes[prop].type.key == 'BOOLEAN') {
				// For check boxes, any string equals true
				update[prop] = !!value;
			} else {
				update[prop] = value;
			}
		}
	});

	if(req.file) {
		var dir = 'public/images/uploads/guilds/' + guild.id;
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

	if(req.body.removeExistingPhoto && guild.photo) {
		var photoPath = 'public/images/uploads/guilds/' + guild.id + '/' + guild.photo; 
		await fs.rm(photoPath, { force: true }); // force ignores exceptions if file doesn't exist
		update.photo = null;
	}

	
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
	
	await Guild.update(update, { where: { id: guild.id }});
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
		const customer = await stripe.customers.create({ email: user.email });
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

	if(req.query.subscribe) {
		// Redirect back to subscribe
		res.redirect('/dashboard/subscribe');
		return;
	}

	if(req.query.guild_subscribe) { 
		// Redirect back to guild-subscribe
		res.redirect('/dashboard/guild-subscribe');
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

router.get('/payments/connect-stripe-account', auth.authorizeRole('creator'), async(req, res) => {
	// Create an Express connected account and prefill information
	// See: https://stripe.com/docs/connect/collect-then-transfer-guide

	var user = await User.findByPk(req.authUser.id);
	var creator = await Creator.findOne({ where: {
		userid: user.id
	}});

	const stripe = require('stripe')(credentials.stripe.secretKey);

	let account;

	if(creator.stripeConnectedAccountId) {
		// Account already created. Ensure charges aren't already enabled.
		if(creator.stripeConnectedAccountOnboarded) {
			req.flash.notice = "You have already connected with Stripe";
			res.redirect('/dashboard/payments');
			return;
		} else {
			account = await stripe.accounts.retrieve(creator.stripeConnectedAccountId);
			if(account.charges_enabled) {
				creator.stripeConnectedAccountOnboarded = true;
				creator.save();
				req.flash.notice = "You have already connected with Stripe";
				res.redirect('/dashboard/payments');
				return;
			} // otherwise continue generating an account link below
		}
	} else {
		account = await stripe.accounts.create({ type: 'express', email: user.email });
		creator.stripeConnectedAccountId = account.id;
		await creator.save();
	}
	
	var protocol = req.app.get('env') == 'production' ? 'https' : 'http';
	const baseUrl = `${protocol}://${req.headers.host}`;
	const accountLink = await stripe.accountLinks.create({
		account: account.id,
		refresh_url: baseUrl + '/dashboard/payments/connect-stripe-account/reauth',
		return_url: baseUrl + '/dashboard/payments/connect-stripe-account/return',
		type: 'account_onboarding'
	});

	res.redirect(accountLink.url);
});

router.get('/payments/connect-stripe-account/reauth', auth.authorizeRole('creator'), async(req, res) => {
	// Stripe directs users here if the link expired, was already used etc.
	// We recreate the link and send them back in
	// See https://stripe.com/docs/connect/collect-then-transfer-guide
	var user = await User.findByPk(req.authUser.id);
	var creator = await Creator.findOne({ where: {
		userid: user.id
	}});

	if(!creator.stripeConnectedAccountId) {
		req.flash.alert = 'There was an error connecting your Stripe account. Please try again.';
		res.redirect('/dashboard/payments');
		return;
	}

	const stripe = require('stripe')(credentials.stripe.secretKey);

	var protocol = req.app.get('env') == 'production' ? 'https' : 'http';
	const baseUrl = `${protocol}://${req.headers.host}`;
	const accountLink = await stripe.accountLinks.create({
		account: creator.stripeConnectedAccountId,
		refresh_url: baseUrl + '/dashboard/payments/connect-stripe-account/reauth',
		return_url: baseUrl + '/dashboard/payments/connect-stripe-account/return',
		type: 'account_onboarding'
	});

	res.redirect(accountLink.url);
});

router.get('/payments/connect-stripe-account/return', auth.authorizeRole('creator'), async(req, res) => {
	// Stripe issues a redirect to this URL when the user completes the Connect Onboarding flow.
	// This doesn't mean that all information has been collected or that there are no outstanding
	// requirements on the account. This only means the flow was entered and exited properly.
	var user = await User.findByPk(req.authUser.id);
	var creator = await Creator.findOne({ where: {
		userid: user.id
	}});

	const stripe = require('stripe')(credentials.stripe.secretKey);

	const account = await stripe.accounts.retrieve(creator.stripeConnectedAccountId);
	if(account.charges_enabled) {
		creator.stripeConnectedAccountOnboarded = true;
		creator.save();
		req.flash.notice = "You have successfully connected your Stripe account";
	} else {
		req.flash.notice = "Your Stripe account hasn't been connected yet.";
	}
	
	res.redirect('/dashboard/payments');
});

router.get('/policy', auth.authorizeRole('creator'), async function(req, res, next) {
	var user = await User.findByPk(req.authUser.id);
	var creator = await Creator.findOne({ where: { userid: user.id }});

	var totalPledges = (await sequelize.query('select sum(amount) pledgeTotal from Pledges where creatorid = :creatorid',
		{ replacements: { creatorid: creator.id }, plain: true, raw: true }));

	// Get active policy execution
	const activeExecution = await PolicyExecution.findOne({
		where: {
			creatorId: creator.id,
			processedAt: null,
			expiresAt: {
				[Op.gt]: new Date()
			}
		},
		raw: true,
		attributes: {
			include: [
				[sequelize.literal('COALESCE((SELECT COUNT(*) FROM PolicyExecutionSupporters WHERE PolicyExecutionSupporters.policyExecutionId = PolicyExecution.id AND agree = true), 0)'), 'agreeCount'],
				[sequelize.literal('COALESCE((SELECT COUNT(*) FROM PolicyExecutionSupporters WHERE PolicyExecutionSupporters.policyExecutionId = PolicyExecution.id AND agree = false), 0)'), 'disagreeCount']
			]
		}
	});

	console.log('Active execution:', activeExecution);

	var pledgeTotal = new Number(totalPledges.pledgeTotal);
	res.render('dashboard/policy', { 
		user, 
		creator, 
		policy: creator.policy, 
		pledgeTotal,
		activeExecution 
	});
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

async function doPolicyExecutionChecks(creator, res) {
	if(!creator.stripeSubscriptionId) {
		return { error: 'You must subscribe before you can activate pledges' };
	}

	if(!creator.stripeConnectedAccountOnboarded) {
		return { error: 'You must connect a Stripe account before you can activate pledges', needsStripeConnect: true };
	}

	var active = await PolicyExecution.findAll({ where: { creatorId: creator.id, processedAt: null }});
	if(active && active.length) {
		return { error: "You already have an active policy execution."};
	}

	return { };
}

router.get('/execute-policy', auth.authorizeRole('creator'), async function(req, res, next) {
	const user = await User.findOne({ where: { id: req.authUser.id }});
	const creator = await Creator.findOne({ where: { userId: user.id }});

	var checks = await doPolicyExecutionChecks(creator, res);
	if(checks.error) {
		if(checks.needsStripeConnect) {
			res.redirect('/dashboard/execute-policy/connect-first');
			return;
		}
		req.flash.alert = checks.error;
		res.redirect(req.headers.referer);
		return;
	}

	res.redirect('/dashboard/execute-policy/1');
});

router.get('/execute-policy/connect-first', auth.authorizeRole('creator'), async (req, res, next) => {
	res.render('dashboard/execute-policy-connect-first');
})

router.get('/execute-policy/1', auth.authorizeRole('creator'), async function(req, res, next) {
	const user = await User.findOne({ where: { id: req.authUser.id }});
	const creator = await Creator.findOne({ where: { userId: user.id }});

	var checks = await doPolicyExecutionChecks(creator, res);
	if(checks.error) {
		req.flash.alert = checks.error;
	}

	res.render('dashboard/execute-policy-step1');
});

router.get('/execute-policy/2', auth.authorizeRole('creator'), async function(req, res, next) {
	const user = await User.findOne({ where: { id: req.authUser.id }});
	const creator = await Creator.findOne({ where: { userId: user.id }});

	var checks = await doPolicyExecutionChecks(creator, res);
	if(checks.error) {
		req.flash.alert = checks.error;
	}

	res.render('dashboard/execute-policy-step2');
});

router.post('/execute-policy/3', auth.authorizeRole('creator'), async function(req, res, next) {
	const user = await User.findOne({ where: { id: req.authUser.id }});
	const creator = await Creator.findOne({ where: { userId: user.id }});
	const reason = req.body.reason;
	res.render('dashboard/execute-policy-step3', { reason, creator });
});

router.post('/execute-policy/execute', auth.authorizeRole('creator'), async function(req, res, next) {
	try {
		console.log('\n=== EXECUTE POLICY REQUEST ===');
		console.log('Headers:', req.headers);
		console.log('Body:', req.body);
		console.log('Query:', req.query);
		console.log('=== END REQUEST INFO ===\n');

		const user = await User.findOne({ where: { id: req.authUser.id }});
		const creator = await Creator.findOne({ where: { userId: user.id }});
		
		console.log('\n=== EXECUTE POLICY ENDPOINT START ===');
		console.log('Creator:', creator.id);
		console.log('User:', user.id);
		console.log('Reason:', req.body.reason);

		var checks = await doPolicyExecutionChecks(creator, res);
		if(checks.error) {
			console.log('Policy execution checks failed:', checks.error);
			return res.status(400).json({ error: checks.error });
		}

		const reason = req.body.reason;
		if (!reason) {
			throw new Error('No reason provided for policy execution');
		}

		const stripe = require('stripe')(credentials.stripe.secretKey);

		// Get all pledges for this creator
		const pledges = await Pledge.findAll({
			where: { creatorId: creator.id }
		});
		console.log('Found pledges:', pledges.length);

		// Create the policy execution record
		const execution = await PolicyExecution.create({
			creatorId: creator.id,
			reason: reason,
			executedAt: new Date(),
			expiresAt: new Date(Date.now() + POLICY_EXECUTION_DURATION_MS),
			status: 'pending'
		});
		console.log('Created execution:', execution.id);

		// Create payment holds for each pledge
		for (const pledge of pledges) {
			console.log('\nProcessing pledge:', pledge.id);
			const supporter = await User.findByPk(pledge.userId);
			console.log('Supporter:', supporter.email);

			let stripePaymentIntentId = null;
			if (req.body.skipStripeChecks !== 'true') {
				if (process.env.NODE_ENV === 'test') {
					stripePaymentIntentId = `pi_test_hold_${pledge.id}`;
					// Store the payment intent in mock Stripe
					await stripe.paymentIntents.create({
						id: stripePaymentIntentId,
						amount: pledge.amount * 100,
						currency: 'usd',
						payment_method_types: ['card'],
						capture_method: 'manual',
						customer: supporter.stripeCustomerId
					});
				} else {
					const paymentIntent = await stripe.paymentIntents.create({
						amount: pledge.amount * 100,
						currency: 'usd',
						payment_method_types: ['card'],
						capture_method: 'manual',
						customer: supporter.stripeCustomerId
					});
					stripePaymentIntentId = paymentIntent.id;
				}
			}

			// Create supporter record with payment intent
			await PolicyExecutionSupporter.create({
				policyExecutionId: execution.id,
				userId: supporter.id,
				pledgeId: pledge.id,
				stripePaymentIntentId,
				holdPlacedAt: new Date()
			});
			console.log('Created supporter record');
			
			// Send email to supporter
			if (req.body.skipEmails !== 'true') {
				const emailText = await ejs.renderFile(
					path.join(__dirname, '../views/emails/policy-execution-created.ejs'),
					{ 
						supporter: supporter,
						execution: { Creator: creator, reason },
						siteUrl: process.env.NODE_ENV === 'development' ? 
							'http://localhost:3000' : 
							'https://becomepluribus.com'
					}
				);
				
				console.log('Sending email to:', supporter.email);
				await email.send(
					supporter.email,
					`${creator.name} has activated their policy protection`,
					emailText
				);
			}
		}

		console.log('\n=== EXECUTE POLICY ENDPOINT END ===\n');
		res.json({ success: true });
	} catch (err) {
		console.error('Policy execution failed:', err);
		res.status(500).json({ error: err.message });
	}
});

router.get('/execute-policy/executed', (req, res) => {
	res.render('dashboard/execute-policy-executed');
});

router.post('/policy-execution-response/:id', auth.authorize, async (req, res) => {
	try {
		console.log('=== Policy Execution Response ===');
		console.log('Request body:', req.body);
		console.log('Response value:', req.body.response);

		const execution = await PolicyExecution.findByPk(req.params.id);
		const supporter = await PolicyExecutionSupporter.findOne({
			where: {
				policyExecutionId: execution.id,
				userId: req.authUser.id
			}
		});

		if (!supporter) {
			return res.status(404).json({ error: 'Policy execution not found' });
		}

		console.log('Before setting agree - response is:', req.body.response);
		supporter.agree = req.body.response === 'agree';
		console.log('After setting agree:', supporter.agree);
		supporter.respondedAt = new Date();
		await supporter.save();

		const message = supporter.agree ? 
			'Your agreement has been recorded. The funds will be released to the creator.' :
			'Your disagreement has been recorded. If more than 50% of supporters disagree within 7 days, the policy execution will be cancelled.';
		console.log('Sending message:', message);

		res.json({
			status: 'success',
			agree: supporter.agree,
			message: message
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Server error' });
	}
});

router.get('/policy-execution-response/:id/agreed', auth.authorize, async (req, res) => {
	const user = await User.findByPk(req.authUser.id);
	const policyExecution = await PolicyExecution.findByPk(req.params.id);
	if(!policyExecution) {
		res.status(404).send('Policy execution not found');
		return;
	}

	const policyExecutionSupporter = await PolicyExecutionSupporter.findOne({ where: { policyExecutionId: policyExecution.id, userId: user.id }});
	const pledge = await Pledge.findByPk(policyExecutionSupporter.pledgeId);
	if(!pledge) {
		res.status(404).send('Pledge not found');
		return;
	}

	const creator = await Creator.findByPk(policyExecution.creatorId);

	res.render('dashboard/policy-execution-response-agreed', { pledge, creator, policyExecution });
});

router.post('/policy-execution-response/:id/pay', auth.authorize, async(req, res) => {
	const stripe = require('stripe')(credentials.stripe.secretKey);

	const user = await User.findByPk(req.authUser.id);
	const policyExecution = await PolicyExecution.findByPk(req.params.id);
	if(!policyExecution) {
		res.status(404).send('Policy execution not found');
		return;
	}

	const policyExecutionSupporter = await PolicyExecutionSupporter.findOne({ where: { policyExecutionId: policyExecution.id, userId: user.id }});
	if(policyExecutionSupporter.stripeCheckoutSessionPaid) {
		res.status(400).send('This pledge has already been paid!');
		return;
	}

	const pledge = await Pledge.findByPk(policyExecutionSupporter.pledgeId);
	if(!pledge) {
		res.status(404).send('Pledge not found');
		return;
	}

	const creator = await Creator.findByPk(policyExecution.creatorId);

	var protocol = req.app.get('env') == 'production' ? 'https' : 'http';
	const baseUrl = `${protocol}://${req.headers.host}`;

	const session = await stripe.checkout.sessions.create({
		mode: 'payment',
		line_items: [{
			price_data: {
				currency: 'usd',
				product_data: {
					name: 'Pledge to ' + creator.name,
				},
				unit_amount: pledge.amount * 100
			},
			quantity: 1
		}],
		payment_intent_data: {
			application_fee_amount: Math.round(pledge.amount * 0.1 * 100),
			transfer_data: { destination: creator.stripeConnectedAccountId },
		},
		success_url: baseUrl + `/dashboard/policy-execution-response/${policyExecution.id}/pay/complete`,
		cancel_url: baseUrl + `/dashboard/policy-execution-response/${policyExecution.id}/pay/cancel`,
	});

	policyExecutionSupporter.stripeCheckoutSessionId = session.id;
	policyExecutionSupporter.stripeCheckoutSessionPaid = false;
	await policyExecutionSupporter.save();

	res.redirect(session.url);
});

router.get('/policy-execution-response/:id/pay/complete', auth.authorize, async (req, res) => {
	// Don't need to do anything here. We use the checkout.complete webhook callback from Stripe
	// to record completion of the payment.
	res.render('dashboard/policy-execution-response-paid');
});

router.get('/policy-execution-response/:id/pay/cancel', auth.authorize, async (req, res) => {
	res.render('dashboard/policy-execution-response-payment-cancelled');
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
    const q = req.query.q || '';
    if (!q) {
        return res.render('dashboard/search', { results: [], q });
    }

	const results = await searchPublicProfiles(q);
	res.render('dashboard/search', { results, q });
});

async function searchPublicProfiles(q) {
    // Split the query into terms
    const terms = q.trim().split(/\s+/);

    // Escape special characters for MySQL full-text search
    const escapedTerms = terms.map(term => term.replace(/['"]/g, '\\$&'));

    // Construct the search string for BOOLEAN MODE
    const searchString = escapedTerms.join(' ');

    // Raw SQL query combining Creators and Guilds with UNION
    const sql = `
	(SELECT 'Creator' AS type, id, name, publicProfile, photo, about,
			MATCH(name) AGAINST(:search IN BOOLEAN MODE) AS score
		FROM Creators
		WHERE publicProfile = 1	)
	UNION
	(SELECT 'Guild' AS type, id, name, publicProfile, photo, about,
			MATCH(name) AGAINST(:search IN BOOLEAN MODE) AS score
		FROM Guilds
		WHERE publicProfile = 1)
	ORDER BY score DESC, name ASC
	LIMIT 100
    `;

	const results = await sequelize.query(sql, {
		replacements: { search: searchString },
		type: sequelize.QueryTypes.SELECT,
	});

	return results;
}

router.get('/pledges', auth.authorize, async (req, res) => {
	const user = await User.findOne({ 
		where: { id: req.authUser.id },
		include: [
			{ model: Creator, required: false, attributes: ['id', 'name'] },
			{ model: Guild, required: false, attributes: ['id', 'name'] }
		] });
	const creator = user.Creator;
	let guild = user.Guild;
	if (!guild && creator) {
		guild = await Guild.findOne({ 
			include: { model: GuildCreator, where: { creatorId: creator.id, status: 'approved' }, attributes: [] },
			attributes: ['id', 'name'],
			required: true
		});
	}
	const pledgesMade = await Pledge.findAll({ where: { userId: user.id }, include: Creator });
	const pledgesReceived = creator ? await Pledge.findAll({ where: { creatorId: creator.id  }, include: User}) : null;
	const guildPledgesMade = await GuildPledge.findAll({ where: { userId: user.id }, include: Guild });
	const guildPledgesReceived = guild ? await GuildPledge.findAll({ where: { guildId: guild.id  }, include: User }) : null;
	res.render('dashboard/pledges', { user, creator, pledgesMade, pledgesReceived, guild, guildPledgesMade, guildPledgesReceived });
});

router.get('/subscription', auth.authorize, async (req, res) => {
	const creator = await Creator.findOne({ where: { userid: req.authUser.id }});
	res.render('dashboard/subscription', { creator });
});

router.get('/subscribe', auth.authorize, async (req, res) => {
	const user = await User.findByPk(req.authUser.id);
	const creator = await Creator.findOne({ where: { userid: user.id }});

	if(creator.stripeSubscriptionId) {
		req.flash.alert = 'You already have a subscription';
		res.redirect('/dashboard/subscription');
		return;
	}
	var stripePublicKey = credentials.stripe.publicKey;

	const stripe = require('stripe')(credentials.stripe.secretKey);
	const product = await stripe.products.retrieve(
		settings.stripe.products.standardSubscription,
		{ expand: [ 'default_price' ]}
	);

	var cardPaymentMethods = await CardPaymentMethod.findAll({ where: { userId: req.authUser.id }});
	var primaryCardPaymentMethod = cardPaymentMethods.find(method => method.id == user.primaryCardPaymentMethodId);

	res.render('dashboard/subscribe', {
		creator,
		stripePublicKey,
		cardPaymentMethods,
		primaryCardPaymentMethod,
		amount: product.default_price.unit_amount / 100
	});
});

router.post('/subscribe', auth.authorize, csrf.validateToken, async(req, res) => {
	const cardId = req.body.card;
	if(!cardId) {
		req.flash.alert = 'Please choose a card or add a new payment method.';
		return res.redirect('/dashboard/subscribe');
	}

	const user = await User.findByPk(req.authUser.id);

	const card = await CardPaymentMethod.findOne({ where: { id: cardId, userId: user.id }});
	if(!card) {
		req.flash.alert = 'Please choose a card or add a new payment method.';
		return res.redirect('/dashboard/subscribe');
	}

	const stripe = require('stripe')(credentials.stripe.secretKey);

	const product = await stripe.products.retrieve(settings.stripe.products.standardSubscription);

	const subscription = await stripe.subscriptions.create({
		customer: user.stripeCustomerId,
		default_payment_method: card.stripePaymentMethodId,
		items: [
			{ price: product.default_price },
		],
	});

	let creator = await Creator.findOne({ where: { userid: user.id }});
	creator.stripeSubscriptionId = subscription.id;
	creator.subscriptionAmount = subscription.items.data[0].price.unit_amount;
	creator.subscriptionCreated = new Date(subscription.created * 1000);
	creator.save();

	// Set the subscriber number, used to show gold/silver/bronze rings around
	// profile photos for early adopters
	if(!creator.subscriberNum) {
		// update Creators set subscriberNum = (select subNum from (select coalesce(max(subscriberNum), 0) + 1 subNum from creators) x) where id = :id;
		await sequelize.query('update Creators set subscriberNum = (select subNum from (select coalesce(max(subscriberNum), 0) + 1 subNum from Creators) x) where id = :id', { replacements: { id: creator.id } });
	}

	req.flash.	notice = 'Subscription was created successfully';

	return res.redirect('/dashboard/subscription');
});

router.get('/cancel-subscription', auth.authorize, async(req, res) => {
	const user = await User.findByPk(req.authUser.id);
	const creator = await Creator.findOne({ where: { userid: user.id }});
	if(!creator.stripeSubscriptionId) {
		req.flash.alert = 'You don\'t have an active subscription';
		res.redirect('/dashboard/subscription');
		return;
	}

	res.render('dashboard/subscription-cancel', { creator });
});

router.post('/cancel-subscription', auth.authorize, csrf.validateToken, async(req, res) => {
	const user = await User.findByPk(req.authUser.id);
	let creator = await Creator.findOne({ where: { userid: user.id }});

	if(!creator.stripeSubscriptionId) {
		req.flash.alert = 'You don\'t have an active subscription';
		res.redirect('/dashboard/subscription');
		return;
	}

	const stripe = require('stripe')(credentials.stripe.secretKey);
	await stripe.subscriptions.del(
		creator.stripeSubscriptionId
	);

	creator.stripeSubscriptionId = null;
	creator.subscriptionAmount = null;
	creator.subscriptionCreated = null;
	creator.save();

	req.flash.notice = 'Your subscription was successfully cancelled.';
	res.redirect('/dashboard/subscription');
});

router.get('/guilds', auth.authorizeRole('creator'), async function(req, res, next) {
	console.log(req.authUser);
	console.log(res.locals.authUser);

	var guild = await Guild.findOne({ where: { userId: res.locals.authUser.id } });
	if (guild) {
		res.redirect('/dashboard/guild');
		return;
	}

	var guildMember = await GuildCreator.findOne(
		{ 
			where: { status: 'approved' },
			include: [{
				required: true,
				model: 	Creator,
				where: { 
					userId: req.authUser.id 
				},
				attributes: []
			}],
			attributes: ['guildId']
		});
	if (guildMember) {
		res.redirect('/guilds/' + guildMember.guildId);
		return;
	}

	// Get public guilds and not fully loaded creators
	var publicGuilds = await Guild.findAll(
		{ where: { 
			publicProfile: true,
		    [Op.and]: [
				sequelize.literal(`(
					SELECT COUNT(*)
					FROM GuildCreators AS gc
					WHERE gc.guildId = Guild.id
					AND gc.status = 'approved'
				) < Guild.maxAllowedCreators`)
			]
		}}); 

	res.render('dashboard/guilds', { publicGuilds });
});

router.get('/guild-subscribe', auth.authorize, async (req, res) => {
	const user = await User.findByPk(req.authUser.id);
	const guild = await Guild.findOne({ where: { userid: user.id }});
	if (guild.stripeSubscriptionId) {
		req.flash.alert = 'You already have a guild subscription';
		res.redirect('/dashboard/guild-subscription');
		return;
	}

	const stripePublicKey = credentials.stripe.publicKey;
	const stripe = require('stripe')(credentials.stripe.secretKey);
	const product = await stripe.products.retrieve(

		// TODO: use guild's subscription product?
		settings.stripe.products.standardSubscription,
		{ expand: [ 'default_price' ]}
	);

	var cardPaymentMethods = await CardPaymentMethod.findAll({ where: { userId: req.authUser.id }});
	var primaryCardPaymentMethod = cardPaymentMethods.find(method => method.id == user.primaryCardPaymentMethodId);
	res.render('dashboard/guild-subscribe', {
		guild,
		stripePublicKey,
		cardPaymentMethods,
		primaryCardPaymentMethod,
		amount: product.default_price.unit_amount / 100
	});
});

router.post('/guild-subscribe', auth.authorize, csrf.validateToken, async(req, res) => {
	const cardId = req.body.card;
	if(!cardId) {
		req.flash.alert = 'Please choose a card or add a new payment method.';
		return res.redirect('/dashboard/guild-subscribe');
	}

	const user = await User.findByPk(req.authUser.id);
	const card = await CardPaymentMethod.findOne({ where: { id: cardId, userId: user.id }});
	if(!card) {
		req.flash.alert = 'Please choose a card or add a new payment method.';
		return res.redirect('/dashboard/guild-subscribe');
	}

	const stripe = require('stripe')(credentials.stripe.secretKey);

	// TODO: use guild's subscription product?
	const product = await stripe.products.retrieve(settings.stripe.products.standardSubscription);
	const subscription = await stripe.subscriptions.create({
		customer: user.stripeCustomerId,
		default_payment_method: card.stripePaymentMethodId,
		items: [
			{ price: product.default_price },
		],
	});

	const guild = await Guild.findOne({ where: { userid: user.id }});
	guild.stripeSubscriptionId = subscription.id;
	guild.subscriptionAmount = subscription.items.data[0].price.unit_amount;
	guild.subscriptionCreated = new Date(subscription.created * 1000);
	guild.save();

	// Set the subscriber number, used to show gold/silver/bronze rings around
	// profile photos for early adopters
	if(!guild.subscriberNum) {
		// update Guilds set subscriberNum = (select subNum from (select coalesce(max(subscriberNum), 0) + 1 subNum from creators) x) where id = :id;
		await sequelize.query('update Guilds set subscriberNum = (select subNum from (select coalesce(max(subscriberNum), 0) + 1 subNum from Guilds) x) where id = :id', { replacements: { id: guild.id } });
	}

	req.flash.notice = 'Subscription was created successfully';

	return res.redirect('/dashboard/guild');
});

router.get('/guild-subscription', auth.authorize, async (req, res) => {
	const user = await User.findOne({
		where: { id: res.locals.authUser.id },
		include: { model: Guild, required: false }
	}); 
	const guild = user.Guild;
	res.render('dashboard/guild-subscription', { guild });
});

router.post('/guild-cancel-subscription', auth.authorize, csrf.validateToken, async(req, res) => {
	const user = await User.findOne({
		where: { id: res.authUser.id },
		include: { model: Guild, required: false }
	}); 
	const guild = user.Guild;

	if(!guild?.stripeSubscriptionId) {
		req.flash.alert = 'You don\'t have an active subscription';
		res.redirect('/dashboard/guild-subscription');
		return;
	}

	const stripe = require('stripe')(credentials.stripe.secretKey);
	await stripe.subscriptions.del(
		guild.stripeSubscriptionId
	);

	guild.stripeSubscriptionId = null;
	guild.subscriptionAmount = null;
	guild.subscriptionCreated = null;
	guild.save();

	req.flash.notice = 'Your subscription was successfully cancelled.';
	res.redirect('/dashboard/guild-subscription');
});

router.get('/execute-policy/:id', auth.authorizeRole('creator'), async function(req, res, next) {
	const user = await User.findOne({ where: { id: req.authUser.id }});
	const creator = await Creator.findOne({ where: { userId: user.id }});

	console.log('Execute policy route - User:', user.id, 'Creator:', creator.id);
	
	// Add debug for template resolution
	console.log('Template path:', __dirname + '/../views/dashboard/execute-policy.ejs');
	
	res.render('dashboard/execute-policy-step1', { // Change template name to match existing structure
		creator,
		csrfToken: req.csrfToken(),
		title: 'Activate pledges'
	});
});

// Only enabled in test environment
if (process.env.NODE_ENV === 'test') {
  router.get('/test/emails', async (req, res) => {
    const emails = await email.getSentEmails(1);
    res.render('test/emails', { emails: emails.emails });
  });

  // Manual test endpoint that bypasses test mode
  router.post('/test/send-real-email', async (req, res) => {
    try {
      const { to, subject, text } = req.body;
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.TEST_EMAIL_USER,
          pass: process.env.TEST_EMAIL_PASS
        }
      });
      
      await transporter.sendMail({
        from: process.env.TEST_EMAIL_USER,
        to,
        subject,
        html: text
      });
      
      res.json({ success: true });
    } catch (err) {
      console.error('Failed to send real email:', err);
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = router;