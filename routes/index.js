var express = require('express');
const { redirect } = require('express/lib/response');
const { body, validationResult } = require('express-validator');
var router = express.Router();
var { Creator, PrelaunchEmail } = require('../models');

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

router.get('/pricing', function(req, res, next) {
	res.render('coming-soon');
});

module.exports = router;
