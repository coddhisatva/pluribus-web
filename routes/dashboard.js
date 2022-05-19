const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../utils/auth');
const { User, Creator, Follow, CardPaymentMethod } = require('../models');
const multer = require('multer');
const upload = multer({ dest: 'uploads/tmp' });
const fs = require('fs/promises');
const path = require('path');
const util = require('../utils/util');
const sharp = require('sharp');
const { serialize } = require('v8');
const credentials = require('../config/credentials');

router.get('/', auth.authorize, async function(req, res, next) {
	var user = await User.findByPk(req.authUser.id);
	var following = await Follow.findAll({ where: { userId: user.id }, include: Creator });
	console.log(following);

	res.render('dashboard/index', { user, following });
});

router.get('/profile', auth.authorizeRole('creator'), async function(req, res, next) {
	var user = await User.findByPk(req.authUser.id);
	var creator = await Creator.findOne({ where: { userId: user.id }});
	if(!creator) {
		res.status(404).send("Creator not found.");
		return;
	}

	res.render('dashboard/profile', { user, creator });
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
			parse: (value) => {
				var m = /^\s*(?:https?:\/\/)?youtube.com\/user\/(\w+)/i.exec(value);
				if(m) return m[1];
				m = /^\s*(\w+)\s*$/i.exec(value);
				if(m) return m[1];
				return null;
			},
			format: (value) => 'https://youtube.com/user/' + value
		},
		instagram: {
			parse: (value) => {
				var m = /^\s*(?:https?:\/\/)?instagram.com\/([a-z0-9_]+)/i.exec(value);
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
	var cardPaymentMethods = await CardPaymentMethod.findAll({ where: { userId: req.authUser.id }});
	var primaryCardPaymentMethod = cardPaymentMethods.find(method => method.id == user.primaryCardPaymentMethodId);

	res.render('dashboard/payments', { stripePublicKey, cardPaymentMethods, primaryCardPaymentMethod });
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
	res.render('dashboard/policy', { policy: creator.policy });
});

router.get('/execute-policy', auth.authorizeRole('creator'), async function(req, res, next) {
	res.render('dashboard/execute-policy');
});

module.exports = router;