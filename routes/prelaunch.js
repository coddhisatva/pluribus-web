var express = require('express');
const { redirect } = require('express/lib/response');
const { body, validationResult } = require('express-validator');
var router = express.Router();
var { Creator, PrelaunchEmail } = require('../models');

/** GET /prelaunch */
router.get('/', function(req, res, next) {
	res.render('prelaunch/index', {  });
});

/** POST /prelaunch(email: string) */
router.post('/',
	body('email').trim().isLength({min:1}).withMessage('Please enter your email address').bail()
		.isEmail().withMessage('Please enter a valid email address'),
	async function(req, res, next) {
		const errors = validationResult(req);
		if(!errors.isEmpty()) {
			res.render('prelaunch/index', { errors });
			return;
		}

		var email = req.body.email;
		var existing = await PrelaunchEmail.findOne({ where: { email: email }});
		if(existing) {
			res.render('prelaunch/index', { alreadySubscribed: true });
			return;
		}

		await PrelaunchEmail.create({ email });

		if(req.app.get('env') == 'production') {
			res.redirect('success');
		} else {
			res.redirect('/prelaunch/success');
		}
		
	}
);

router.get('/success', function(req, res, next) {
	res.render('prelaunch/success');
	return;
});

module.exports = router;
