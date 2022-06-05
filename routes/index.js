var express = require('express');
const { redirect } = require('express/lib/response');
const { body, validationResult } = require('express-validator');
var router = express.Router();
var { Creator } = require('../models');

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
	creatorCount = await Creator.count();
	res.render('index', { creatorCount });
});

router.get('/how-it-works', function(req, res) {
	res.render('how-it-works');
});

router.get('/about', function(req, res) {
	res.render('about');
});

router.get('/roadmap', function(req, res) {
	res.render('roadmap');
});

module.exports = router;
