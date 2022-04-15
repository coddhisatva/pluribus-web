const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../utils/auth');
const { User, Creator, Follow } = require('../models');
const multer = require('multer');
const upload = multer();

router.get('/', auth.authorize, async function(req, res, next) {
	var user = await User.findByPk(req.authUser.id);
	var following = await Follow.findAll({ where: { userId: user.id }, include: Creator });
	console.log(following);

	res.render('dashboard/index', { user, following });
});

router.get('/profile', auth.authorize, async function(req, res, next) {
	var user = await User.findByPk(req.authUser.id);
	var creator = await Creator.findOne({ where: { userId: user.id }});
	if(!creator) {
		res.status(404);
		return;
	}

	res.render('dashboard/profile', { user, creator });
});

router.post('/profile', auth.authorize, upload.none(), async function(req, res, next) {
	var user = await User.findByPk(req.authUser.id);
	var creator = await Creator.findOne({ where: { userId: user.id }});

	var update = { };
	['name', 'about'].forEach(prop => {
		var value = req.body[prop];
		if(value) {
			update[prop] = value;
		}
	});
	
	await Creator.update(update, { where: { id: creator.id }});

	res.send('OK');
});

module.exports = router;