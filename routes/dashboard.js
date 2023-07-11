const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../utils/auth');
const csrf = require('../utils/csrf');
const { sequelize, User, Creator, Follow, CardPaymentMethod, Pledge, PolicyExecution, PolicyExecutionSupporter } = require('../models');
const mysql = require('mysql2');
const multer = require('multer');
const upload = multer({ dest: 'uploads/tmp' });
const fs = require('fs/promises');
const path = require('path');
const util = require('../utils/util');
const email = require('../utils/email');
const sharp = require('sharp');
const { serialize } = require('v8');
const credentials = require('../config/credentials');
const settings = require('../config/settings');

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

	var protocol = req.app.get('env') == 'production' ? 'https' : 'http';
	var inviteBase = protocol + '://' + req.headers.host + '/invite/';
	var profileLink = protocol + '://' + req.headers.host + '/creators/' + creator.id;

	res.render('dashboard/profile', { user, creator, inviteBase, profileLink });
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
	// This doesn’t mean that all information has been collected or that there are no outstanding
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

async function doPolicyExecutionChecks(creator, res) {
	if(!creator.stripeSubscriptionId) {
		return { error: 'You must subscribe before you can activate pledges' };
	}

	if(!creator.stripeConnectedAccountOnboarded) {
		return { error: 'You must connect a Stripe account before you can activate pledges' };
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
		req.flash.alert = checks.error;
		res.redirect(req.headers.referer);
	}

	res.redirect('/dashboard/execute-policy/1');
});

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

	var checks = await doPolicyExecutionChecks(creator, res);
	if(checks.error) {
		req.flash.alert = checks.error;
	}

	const reason = req.body.reason;
	req.session.policyExecution = { reason };
	res.render('dashboard/execute-policy-step3', { reason, creator });
});

router.get('/execute-policy/execute', auth.authorizeRole('creator'), async function(req, res, next) {
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

	var env = req.app.get('env');

	// Notify Pluribus
	var notifyEmails = [ 'luke@smalltech.com.au' ];
	if(env != 'development') {
		notifyEmails.push('help@becomepluribus.com');
	}
	email.send(env, { from: 'noreply@becomepluribus.com',
		to: notifyEmails,
		subject: `A creator has activated their pledges (${env})`,
		text: `${creator.name} (id=${creator.id}) activated their pledges at ${req.hostname}:\r\n
${reason}`
	});

	// Notify the creator
	email.send(env, {
		from: 'help@becomepluribus.com',
		to: user.email,
		subject: "You've activated your pledges on Pluribus",
		text: `Hi ${creator.name},
		
You've activated your pledges on Pluribus.

What happens next?
==================
Donors have seven days to object if they feel the claim falls outside the mutually agreed upon parameters or is otherwise perceived to be illegitimate (such as deliberately triggering consequences just to receive a payout). If less than 50% of donors formally object to your claim within a week, the claim is approved and the funds are officially transferred.

The assumption of legitimacy as a baseline as opposed to putting every claim up to a vote is to ensure the security (both financial and psychological) of the recipients. For anyone to object, they must go out of their way to express it- which they will if they feel they’ve been taken advantage of. Otherwise, there are few reasons why either side would find themselves at odds with the other.


If you have any questions, please get in touch with us at help@becomepluribus.com`
	});

	res.redirect('/dashboard/execute-policy/executed');
});

router.get('/execute-policy/executed', (req, res) => {
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
			req.flash.notice = "Your answer has been recorded. Thanks!";
			res.redirect(`/dashboard/policy-execution-response/${req.params.id}/agreed`);
			return;
		case 'disagree':
			policyExecutionSupporter.agree = false;
			policyExecutionSupporter.respondedAt = new Date();
			await policyExecutionSupporter.save();
			res.render('/dashboard/policy-execution-response-disagreed');
			return;
		default:
			res.status(400).send('Invalid response');
			return;
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

	res.render('dashboard/search', { results, q });
});

router.get('/pledges', auth.authorize, async (req, res) => {
	const user = await User.findByPk(req.authUser.id);
	const creator = await Creator.findOne({ where: { userid: user.id }});

	const pledgesMade = await Pledge.findAll({ where: { userId: user.id }, include: Creator });
	const pledgesReceived = creator ? await Pledge.findAll({ where: { creatorId: creator.id  }, include: User}) : null;

	res.render('dashboard/pledges', { user, creator, pledgesMade, pledgesReceived });
});

router.get('/subscription', auth.authorize, async (req, res) => {
	const user = await User.findByPk(req.authUser.id);
	const creator = await Creator.findOne({ where: { userid: user.id }});

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

	req.flash.notice = 'Subscription was created successfully';

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

module.exports = router;