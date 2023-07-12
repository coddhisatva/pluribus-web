var express = require('express');
const { redirect } = require('express/lib/response');
const { body, validationResult } = require('express-validator');
var router = express.Router();
var { User, Creator, PrelaunchEmail, Follow, Pledge } = require('../models');
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

router.get('/roadmap', function(req, res) {
	res.render('roadmap');
});

router.get('/faq/creators', function(req, res) {
	res.render('faq-creators');
});

router.get('/faq/supporters', function(req, res) {
	res.render('faq-supporters');
});

router.get('/pricing', function(req, res, next) {
	res.render('pricing');
});

router.get('/invite/:code', async function(req, res, next) {
	let creator = await Creator.findOne({ where: { inviteCode: req.params.code }, include: User });

	if(!creator) {
		res.status(404).send('Invalid invite code.');
		return;
	}

	// Now we let invited users view the profile
	/*
	if(!req.authUser) {
		req.flash.notice = creator.name + ' is using Pluribus. Please create an account or log in to follow them.';
		res.redirect('/users/signup?invite=' + req.params.code);
		return;
	}*/

	let isFollowing = false;
	let pledge = null;
	if(req.authUser) {
		let follow = await Follow.findOne({ where: { userId: req.authUser.id, creatorId: creator.id } });
		if(follow !== null) {
			isFollowing = true;
		}

		pledge = await Pledge.findOne({ where: { creatorId: creator.id, userId: req.authUser.id }});
	}

	var followerCount = await Follow.count({ where: { creatorId: creator.id } });
	var supporterCount = await Pledge.count({ where: { creatorId: creator.id }});

	var creatorViewingOwnProfile = req.authUser && (creator.User.id == req.authUser.id);

	res.render('creators/show', { creator, isFollowing, invite: req.params.code, followerCount, supporterCount, pledge, creatorViewingOwnProfile });
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
