const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../utils/auth');
const { User, Creator, Follow } = require('../models');

router.get('/', auth.authorize, async function(req, res, next) {
	var user = await User.findByPk(req.authUser.id);
	var following = await Follow.findAll({ where: { userId: user.id }, include: Creator });
	console.log(following);

	res.render('dashboard/index', { user, following });
});

module.exports = router;