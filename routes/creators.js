var express = require('express');
var router = express.Router();
var { Creator, User } = require('../models');

router.get('/', async function(req, res, next) {
	var creators = await Creator.findAll();
	res.render('creators/index', { creators });
});

router.get('/:id', async function(req, res, next) {
	var creator = await Creator.findByPk(req.params.id, { include: User });
	res.render('creators/show', { title: creator.name, creator });
});

module.exports = router;