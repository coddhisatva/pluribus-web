const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { sequelize, Creator, Guild, GuildCategory, GuildCreator, GuildCreatorVote, GuildFollow, CardPaymentMethod, GuildPledge, User } = require('../models');
const { Op } = require('sequelize');
const { body, validationResult } = require('express-validator');
const auth = require('../utils/auth');
const csrf = require('../utils/csrf');
const email = require('../utils/email');
const credentials = require('../config/credentials');
const settings = require('../config/settings');
require('../utils/handleAsyncErrors').fixRouter(router);

async function ensureNoGuild(req, res, next) {
	// If there's no logged in user, redirect to user registration
	// with continue=guild
	if(res.locals.authUser == null) {
		res.redirect('/users/signup?continue=guild');
		return;
	}
	  
	var guild = await Guild.count({ where: { userId: res.locals.authUser.id } });
	if(guild) {
		req.flash.alert = 'You already have a guild.';
		res.redirect('/dashboard');
		return;
	}

	next();
}

async function checkGuildNameUnique(req, res, next) {
	const name = req.body.name;
	try {
		if (name) {
			const existingGuild = await Guild.findOne({ name: name });
			if (existingGuild) {
				req.validationErrors = validationResult(req).array();
				req.validationErrors.push({
					param: 'name',
					msg: 'Guild name already in use',
					value: name
				});
			}
		}

		next();
	} catch (error) {
		next(error);
	}
}

router.get('/', async function(req, res, next) {
	var guild = await Guild.findOne({ where: { userId: res.locals.authUser.id } });
	var guilds = await Guild.findAll({ where: { publicProfile: true }});
	res.render('guilds/index', { guilds, guild });
});

router.get('/new', ensureNoGuild, async function(req, res, next) {
	res.redirect('/guilds/new/name');
});

router.get('/new/categories', ensureNoGuild, async function(req, res, next) {
	res.render('guilds/new-categories');
});

router.post('/new/categories',
	ensureNoGuild,
	async function(req, res, next) {
		if(!req.session.guildSignup) {
			req.session.guildSignup = { };
		}
		req.session.guildSignup.categories = Array.isArray(req.body.categories) ?
			req.body.categories : [req.body.categories];
		res.redirect('/guilds/new/about');
	}
);

router.get('/new/about', ensureNoGuild, function(req, res, next) {
	res.render('guilds/new-about');
});

router.post('/new/about',
	ensureNoGuild,
	body('about').trim().isLength({ min: 20 }).withMessage('Please write a bit more about the guild'),

	function(req, res, next) {
		var errors = validationResult(req);
		if(!req.body.skip) {
			if(!errors.isEmpty()) {
				res.render('guilds/new-about', { errors });
				return;
			}
	
			if(!req.session.guildSignup) {
				req.session.guildSignup = { };
			}

			req.session.guildSignup.about = req.body.about;
		}
		
		res.redirect('/guilds/new/name');
	}
);

router.get('/new/name', ensureNoGuild, function(req, res) {
	res.render('guilds/new-name', { });
});

router.post('/new/name',
	ensureNoGuild,
	body('name').trim().isLength({ min: 1 }).withMessage('Please enter your name'),
	checkGuildNameUnique,
	async function(req, res, next) {
		if(!req.body.skip) {
			var errors = validationResult(req);
			if(!errors.isEmpty()) {
				res.render('guilds/new-name', { errors });
				return;
			}

			if(!req.session.guildSignup) {
				req.session.guildSignup = { };
			}

			req.session.guildSignup.name = req.body.name;
			req.session.guildSignup.publicProfile = req.body.publicProfile == '1';
		}

		res.redirect('/guilds/new/policy');
	}
);

router.get('/new/policy', ensureNoGuild, async function(req, res) {
	res.render('guilds/new-policy', { });
});

router.post('/new/policy',
	ensureNoGuild,
	body('policy').trim().isLength({ min: 20 }).withMessage('Please enter more text (20 character minimum)'),
	async function(req, res, next) {

		var errors = validationResult(req);
		if(!errors.isEmpty()) {
			res.render('guilds/new-policy', { errors });
			return;
		}

		const userId = res.locals.authUser.id;
		const c = await Creator.findOne({ where: { userId: userId } }); 
		if (c === null) {
			res.status(400).send('Must be a creator to create a guild.');
			return;
		}

		var policy = req.body.policy;
		var about = req.session.guildSignup?.about || '';
		var name = req.session.guildSignup?.name || '';
		var publicProfile = req.session.guildSignup?.publicProfile || false;
		var inviteCode = new Buffer.from(crypto.randomBytes(21)).toString('base64');
		var guild = await Guild.create({
			name,
			about,
			policy,
			userId,
			displaySupporterCount: true,
			publicProfile,
			inviteCode
		});

		// Categories	
		await GuildCategory.bulkCreate((req.session.guildSignup?.categories || []).map(category => ({ guildId: guild.id, category })));
		await GuildCreator.create({ guildId: guild.id, creatorId: c.id, status: 'approved', requestedAt: new Date(), approvedAt: new Date(), requiredYeaVotes: 0 });

		req.session.authUser.roles.push('guildAdmin');

		res.redirect('/dashboard/guild-subscribe');
	}
);

router.get('/:id', async function(req, res, next) {
	const guild = await Guild.findOne({
			where: { id: req.params.id },
			include: [
				User,
				GuildCategory,
				{ model: GuildCreator, include: Creator, required: false, where: { status: 'approved' } }
			] 
		});   
	if(!guild) {
		res.status(404).send('Guild not found.');
		return;
	}

	const isOwner = req.authUser && req.authUser.id == guild.userId;
	let isFollowing = false;
	let isMember = false;
	let pledge = null;
	let canJoin = false;
	let candidates = [];
	if(req.authUser && req.authUser.id) {
		const follow = await GuildFollow.findOne({ where: { userId: req.authUser.id, guildId: guild.id } });
		if(follow !== null) {
			isFollowing = true;
		}

		const member = await GuildCreator.findOne({
			where: { guildId: guild.id },
			include: { 
				model: Creator, 
				required: true,
				where: { userId: req.authUser.id }
			}
		});
		if(member !== null) {
			isMember = true;
			const candidatesTmp = await GuildCreator.findAll({  
				where: { guildId: guild.id, status: 'requested' },
			 	include: Creator
			});
			const votesTmp = await GuildCreatorVote.findAll({
				where: { guildId: guild.id, votingCreatorId: member.Creator.id } });

			for (const candidate of candidatesTmp) {
				const vote = votesTmp.find(v => v.creatorId === candidate.Creator.id && v.votingCreatorId === member.Creator.id);

				candidates.push({
					candidate,
					vote: vote?.vote
				});
			}
		}

		pledge = await GuildPledge.findOne({ where: { guildId: guild.id, userId: req.authUser.id }});

		if (!isMember) {
			// ensure not already a member of any guild
			canJoin = (await sequelize.query( 
				`SELECT 1 FROM Creators c WHERE c.userId = :userId
				AND NOT EXISTS (
				SELECT 1 FROM GuildCreators gc WHERE gc.creatorId = c.id 
				AND gc.status IN ('requested', 'approved')
				)`,
				{ replacements: { userId: req.authUser.id }, plain: true, raw: true })) !== null;
		}
	}

	const followerCount = await GuildFollow.count({ where: { guildId: guild.id } });
	const creatorCount = await GuildCreator.count({ where: { guildId: guild.id, status: 'approved' } });
	const pledgeSummary = (await sequelize.query('select count(amount) supporterCount, sum(amount) pledgeTotal from GuildPledges where guildid = :guildid',
		{ replacements: { guildid: guild.id }, plain: true, raw: true }));

	const supporterCount = new Number(pledgeSummary.supporterCount);
	const pledgeTotal = new Number(pledgeSummary.pledgeTotal);

	// Don't let users view a Guild's private profile if they're not already following them
	if(!(isOwner || isFollowing) && !guild.publicProfile && !req.authUser.roles.includes(`view-guild-${guild.id}`)) {
		res.status(403).send("This guild's profile is only visible to their followers.");
		return;
	}

	const guildViewingOwnProfile = req.authUser && (guild.User.id == req.authUser.id);
	res.render('guilds/show', { 
		guild, 
		isFollowing, 
		followerCount, 
		supporterCount, 
		creatorCount, 
		pledgeTotal, 
		pledge, 
		guildViewingOwnProfile,
		showJoin: !guildViewingOwnProfile,
		isFull: guild.maxAllowedCreators <= creatorCount,
		canJoin,
		isMember,
		candidates
	 });
});

/**
 * POST /:id/follow
 * Sets the authenticated user to follow the guild specified by :id.
 */
router.post('/:id/follow', auth.authorize, async function(req, res, next) {
	var guildId = req.params.id;
	var guild = await Guild.findByPk(guildId, { include: User });

	// Don't let just anyone follow a private profile
	if(!guild.publicProfile) {
		if (!req.authUser.roles.includes(`view-guild-${guild.id}`)) {
			res.sendStatus(404);
			return;
		}
	}

	var userId = res.locals.authUser.id;
	await GuildFollow.create({ guildId, userId });

	// Email notification
	var name = res.locals.authUser.name;
	if(!name) {
		// If the user has a creator account, use the creator's display name.
		var followerCreator = await Creator.findOne({ where: { userId: res.locals.authUser.id }});
		if(followerCreator) {
			name = followerCreator.name;
		}
	}

	email.send(req.app.get('env'), {
		from: 'noreply@becomepluribus.com',
		to: guild.User.email,
		subject: 'New follower on Pluribus',
		text: `The guild has a new follower on Pluribus:\r\n
${name || '(anonymous)'}`
	});

	res.sendStatus(200);
});

/**
 * POST /:id/unfollow
 * Sets the authenticated user to NOT follow the guild specified by :id.
 */
 router.post('/:id/unfollow', auth.authorize, async function(req, res, next) {
	var guildId = req.params.id;
	var userId = res.locals.authUser.id;
	var follow = await GuildFollow.findOne({ where: { guildId, userId }});
	if(follow) {
		await follow.destroy();
	}

	res.sendStatus(200);
});

router.get('/:id/pledge', auth.authorize, async (req, res) => {
	var guild = await Guild.findByPk(req.params.id, { include: [ User, GuildCategory ] });
	if(!guild) {
		res.status(404).send('Guild not found.');
		return;
	}

	if(!guild.stripeSubscriptionId) {
		req.flash.alert = "Guild must have a subscription to accept pledges.";
		res.redirect(guild.publicProfile ? '/guilds/' + id : '/invite/' + encodeURIComponent(guild.inviteCode));
		return;
	}

	var user = await User.findByPk(req.authUser.id);

	var stripePublicKey = credentials.stripe.publicKey;

	var cardPaymentMethods = await CardPaymentMethod.findAll({ where: { userId: req.authUser.id }});
	var primaryCardPaymentMethod = cardPaymentMethods.find(method => method.id == user.primaryCardPaymentMethodId);

	res.render('guilds/pledge', { guild, stripePublicKey, cardPaymentMethods, primaryCardPaymentMethod });
});

router.post('/:id/pledge', auth.authorize, csrf.validateToken, async(req, res) => {
	const userId = req.authUser.id;
	const guildId = req.params.id;
	const guild = await Guild.findByPk(guildId, { include: User });
	if(!guild) {
		res.status(400).send('Invalid pledge.');
		return;
	}

	if(!guild.stripeSubscriptionId) {
		req.flash.alert = "Guild must have a subscription to accept pledges.";
		res.redirect(guild.publicProfile ? '/guilds/' + id : '/invite/' + encodeURIComponent(guild.inviteCode));
		return;
	}

	// Don't allow pledging to non-public profile unless the user follows this guild or they have an invite code
	if(!guild.publicProfile) {
		if(!req.query.invite || !req.query.invite == guild.inviteCode) {
			var follow = await GuildFollow.findOne({ where: { userId, guildId } });
			if(!follow) {
				res.status(400).send('Invalid pledge.');
				return;
			}
		}
	}

	// Note: DB constraint will disallow multiple pledges by a user to the same guild

	const frequency = 'once'; //req.body.frequency;
	const amount = Number(req.body.amount);

	switch(frequency) {
		case 'once':
			break;
		default:
			res.status(400).send('Invalid frequency: ' + frequency);
			return;
	}

	if(isNaN(amount) || amount < 5) {
		res.status(400).send('Invalid amount: ' + amount + '. Must be 5 or greater.');
		return;
	}

	try {
		await GuildPledge.create({
			userId,
			guildId,
			frequency,
			amount
		});
	} catch(err) {
		if(err.name == "SequelizeUniqueConstraintError") {
			res.status(400).send('You have already pledged to this guild.');
			return;
		}
		throw err; // unexpected error
	}

	// Email notification
	var name = res.locals.authUser.name;
	if(!name) {
		// If the user has a creator account, use the creator's display name.
		var supporterCreator = await Creator.findOne({ where: { userId: res.locals.authUser.id }});
		if(supporterCreator) {
			name = supporterCreator.name;
		}
	}

	email.send(req.app.get('env'), {
		from: 'noreply@becomepluribus.com',
		to: guild.User.email,
		subject: 'New pledge on Pluribus',
		text: `You have a new pledge on Pluribus:\r\n
${name || '(anonymous)'} pledged $${amount}`
	});

	res.redirect('/guilds/' + req.params.id + '/pledged');
});

router.get('/:id/pledged', auth.authorize, async(req, res) => {
	const guild = await Guild.findByPk(req.params.id);
	if(!guild) {
		res.status(404).send('Guild not found.');
	}
	res.render('guilds/pledged', { guild });
});

router.post('/:id/join', auth.authorize, async(req, res) => {
	const u = await User.findOne(
		{ where: { id: res.locals.authUser.id }, include: Creator });

	if (u?.Creator == null) {
		res.status(400).send('Must be a creator to request access to a guild.');
	}

	const guild = await Guild.findByPk(req.params.id, {
		include: {
			model: GuildCreator,
			where: { status: { [Op.in]: ['requested', 'approved'] } },
			required: false
		} 
	});
	if (guild.GuildCreators.length >= guild.maxAllowedCreators) {
		res.status(403).send('This guild is full.');
		return;
	}
	
	// TODO: what to do if user already requested access to guild or belongs to anohter guild?
	const gc = guild.GuildCreators.some(gc => gc.creatorId === u.Creator.id);
	if(gc) {
		res.status(400).send('You have already requested access to this guild.');
		return;
	}

	const requiredYeaVotes = Math.max(Math.floor(guild.GuildCreators.length * guild.creatorApprovalPercentage), 1); 
	await GuildCreator.create({
		guildId: req.params.id,
		creatorId: u.Creator.id,
		requestedAt: new Date(),
		requestExpiresAt: new Date(Date.now() + (24 * 60 * 60 * 1000 * 14)), // 14 days
		requiredYeaVotes
	});
	res.status(200).send('Requested access to guild.');
	return;
});

router.post('/:id/creators/:creatorId/vote', auth.authorize, async(req, res) => {
	const gc = await GuildCreator.findOne({ 
		where: {
			guildId: req.params.id,
			creatorId: req.params.creatorId
		}, 
		include: [ Creator, { model: Creator, include: User }, Guild ] 
	});
	if(!gc) {
		res.status(404).send('Guild Creator request not found.');
		return;
	}

	if (gc.requestExpiresAt < new Date()) {
		res.status(403).send('This request for access to this guild has expired.');
		if (gc.status === 'requested') {
			await GuildCreator.update(
				{ status: 'rejected' },
				{ where: {
						guildId: req.params.id,
						creatorId: req.params.creatorId
					}
				}
			)
		}
		return;
	}

	const guild = gc.Guild;
	const guildCreatorCount = await GuildCreator.count({ where: { guildId: req.params.id, status: 'approved' } });
	if (guildCreatorCount >= guild.maxAllowedCreators) {
		res.status(403).send('This guild is full.');
		return;
	}

	const creatorAuthUser = await Creator.findOne({ where: { userId: res.locals.authUser.id }});
	if (creatorAuthUser == null) {
		res.status(403).send('You must be a creator to vote.');
		return;
	}

	const guildMemberAuthUser = await GuildCreator.findOne({ where: { guildId: req.params.id, creatorId: creatorAuthUser.id, status: 'approved' } });
	if (guildMemberAuthUser == null) {
		res.status(403).send('You must be a guild member to vote.');
		return;
	}

	if (guildMemberAuthUser.approvedAt > gc.requestedAt) {
		res.status(403).send('You cannot vote on a guild member that has requested access before you were approved.');
		return;
	}

	const existingVote = await GuildCreatorVote.findOne({
		where: {
			guildId: req.params.id,
			creatorId: req.params.creatorId,
			votingCreatorId: creatorAuthUser.id,
		}
	});
	if (existingVote) {
		if (gc.status === 'requested') {
			// allow update vote when creator is not approved
			await GuildCreatorVote.update(
				{ vote: req.body.vote, votedAt: new Date() },
				{ where: {
						guildId: req.params.id,
						creatorId: req.params.creatorId,
						votingCreatorId: creatorAuthUser.id,
					}
				}
			)
		}
	}
	else {
		// allow to create a vote if not voted, and creator is approved
		await GuildCreatorVote.create({
			guildId: req.params.id,
			creatorId: req.params.creatorId,
			votingCreatorId: creatorAuthUser.id,
			vote: req.body.vote
		});
	}

	if (req.headers['hx-request']) {
		const candidate = await GuildCreator.findOne({ 
			where: { guildId: guild.id, creatorId: req.params.creatorId },
			include: Creator
		});
		res.render('guilds/_candidate-vote', { guild, candidate, vote: req.body.vote, layout: false });
	}

	if (gc.status !== 'requested') {
		return;
	}

	const yeas = await GuildCreatorVote.count({ where: { guildId: req.params.id, creatorId: req.params.creatorId, vote: 'yea' } });
	if (gc.requiredYeaVotes <= yeas) {
		await GuildCreator.update(
			{ approvedAt: new Date(), status: 'approved' },
			{ where: {
					guildId: req.params.id,
					creatorId: req.params.creatorId
				}
			}
		)

		// TODO: review email copy
		email.send(req.app.get('env'), {
			from: 'noreply@becomepluribus.com',
			to: gc.Creator.User.email,
			subject: 'Welcome to the guild!',
			text: `You have been accepted as a creator to the "${gc.Guild.name}" guild.`
		});
	}
});

module.exports = router;