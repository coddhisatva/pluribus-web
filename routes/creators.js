var express = require('express');
var router = express.Router();
var { Creator, User, Follow } = require('../models');
const auth = require('../utils/auth');

router.get('/', async function(req, res, next) {
	var creators = await Creator.findAll();
	res.render('creators/index', { creators });
});

router.get('/:id', async function(req, res, next) {
	var creator = await Creator.findByPk(req.params.id, { include: User });

	var isFollowing = false;
	if(req.authUser) {
		var follow = await Follow.findOne({ where: { userId: req.authUser.id, creatorId: creator.id } });
		if(follow !== null) {
			isFollowing = true;
		} 
	}
	res.render('creators/show', { title: creator.name, creator, isFollowing });
});

/**
 * POST /:id/follow
 * Sets the authenticated user to follow the creator specified by :id.
 */
router.post('/:id/follow', async function(req, res, next) {
	if(!req.authorize()) { return; }

	var creatorId = req.params.id;
	var userId = res.locals.authUser.id;
	await Follow.create({ creatorId,  userId });

	res.sendStatus(200);
});

/**
 * POST /:id/unfollow
 * Sets the authenticated user to NOT follow the creator specified by :id.
 */
 router.post('/:id/unfollow', async function(req, res, next) {
	if(!req.authorize()) { return; }

	var creatorId = req.params.id;
	var userId = res.locals.authUser.id;
	var follow = await Follow.findOne({ where: { creatorId, userId }});
	if(follow) {
		await follow.destroy();
	}

	res.sendStatus(200);
});

module.exports = router;