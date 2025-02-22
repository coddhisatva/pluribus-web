var express = require('express');
const { body, validationResult } = require('express-validator');
var router = express.Router();
var { Creator, Guild, PrelaunchEmail, User } = require('../models'); 
const auth = require('../utils/auth');
const csrf = require('../utils/csrf');
const credentials = require('../config/credentials');
require('../utils/handleAsyncErrors').fixRouter(router);

/**
 * GET /
 * Shows the home page, or redirects the logged-in user to their dashboard
 */ 
router.get('/', async function(req, res, next) {

	// If the user is logged in, take them to their dashboard
	if(req.authUser != null) {
		res.redirect('/dashboard');
		return;
	}

	// Home page
	//creatorCount = await Creator.count();
	res.render('index');
});

/** POST /newsletter(email: string) */
router.post('/newsletter',
	body('email').trim().isLength({min:1}).withMessage('Please enter your email address').bail()
		.isEmail().withMessage('Please enter a valid email address'),
	async function(req, res, next) {
		const errors = validationResult(req);
		if(!errors.isEmpty()) {
			req.flash.alert = "Please enter a valid email address!";
			res.render('index');
			return;
		}

		var email = req.body.email;
		var existing = await PrelaunchEmail.findOne({ where: { email: email }});
		if(existing) {
			req.flash.notice = "You've already subscribed to the newsletter.";
			res.render('index');
			return;
		}

		await PrelaunchEmail.create({ email });

		res.redirect('newsletter-signup')
	}
);

router.get('/newsletter-signup', (req, res) => {
	res.render('newsletter-signup');
})

router.get('/how-it-works', function(req, res) {
	res.render('how-it-works');
});

router.get('/about', function(req, res) {
	res.render('about');
});

/*
router.get('/roadmap', function(req, res) {
	res.render('roadmap');
});*/

router.get('/faq/creators', function(req, res) {
	res.render('faq-creators');
});

router.get('/faq/supporters', function(req, res) {
	res.render('faq-supporters');
});

router.get('/pricing', function(req, res, next) {
	res.render('pricing');
});

router.get('/invite/:code', auth.authorize, async function(req, res, next) {
	const creator = await Creator.findOne({ where: { inviteCode: req.params.code }, include: User });
	if(creator) {
		req.session.authUser.roles.push(`view-creator-${creator.id}`);
		res.redirect(`/creators/${creator.id}`);
		return;
	}

	const guild = await Guild.findOne({ where: { inviteCode: req.params.code }, include: User });
	if(guild) {
		req.session.authUser.roles.push(`view-guild-${guild.id}`);
		res.redirect(`/guilds/${guild.id}`);
		return;
	}

	res.status(404).send('Invalid invite code.');
	return;

});

router.get('/support', function(req, res, next) {
	res.render('support');
});

router.get('/support/card', function(req, res, next) {
	res.render('support-card');
});

router.get('/support/card/init', (req, res) => {
	// in case user loads this page manually, redirect back to the start
	res.redirect('/support/card');
});

router.post('/support/card/init', csrf.validateToken, async (req, res, next) => {
	// create a payment intent
	const stripe = require('stripe')(credentials.stripe.secretKey);

	let amountCents = new Number(req.body.amount) * 100;

	const paymentIntent = await stripe.paymentIntents.create({
		amount: amountCents,
		currency: 'usd',
		payment_method_types: [ 'card' ],
		metadata: {
			email: req.body.email,
			contactable: req.body.contactable == '1',
		}
	});

	res.render('support-card-init', { paymentIntent, stripePublicKey: credentials.stripe.publicKey });
});

router.post('/support/card/update', async(req, res) => {
	const intent = await stripe.paymentIntents.update(
		'{{PAYMENT_INTENT_ID}}',
		{amount: 1499}
	);
	res.json({status: intent.status});
});

router.get('/support/card/complete', async (req, res) => {
	res.render('support-card-complete', { stripePublicKey: credentials.stripe.publicKey });
});

router.get('/support/crypto', async (req, res) => {
	res.render('support-crypto');
});

router.get('/contact', async (req, res) => {
	res.render('contact');
});

router.get('/terms', async (req, res) => {
	res.render('terms');
});

module.exports = router;
