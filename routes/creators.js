var express = require('express');
var router = express.Router();
var models = require('../models');

router.get('/', async function(req, res, next) {
	var creators = await models.Creator.findAll();
	res.render('creators/index', { title: 'Creators', creators });
});

router.get('/:id', async function(req, res, next) {
	var creator = await models.Creator.findByPk(req.params.id, { include: models.User });
	console.log(creator);
	res.render('creators/show', { title: creator.name, creator });
});

module.exports = router;