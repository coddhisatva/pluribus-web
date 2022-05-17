const express = require('express');
const router = express.Router();
const auth = require('../utils/auth');
const csrf = require('../utils/csrf');
const credentials = require('../config/credentials');
const email = require('../utils/email');
const { Creator, User, sequelize } = require('../models');

router.all('*', (req, res, next) => {
	if(!/log(?:in|out)?/.test(req.path)) {
		auth.authorizeRole('admin', '/admin/login')(req, res, next);
		return;
	}
	next();
});

router.get('/login', function(req, res, next) {
	res.render('admin/login');
});

router.post('/login', csrf.validateToken, function(req, res, next) {
	var errors = [];

	if(req.body.email != credentials.admin.username) {
		errors.push({ msg: 'Unknown user', param: 'email' });
	}

	if(!auth.verifyPassword(req.body.password, credentials.admin.password)) {
		errors.push({ msg: 'Invalid password', param: 'password'});
	}

	if(errors.length > 0) {
		res.render('admin/login', { errors });
		return;
	}

	req.session.authUser = { email: req.body.email, roles: [ 'admin' ] };
	res.redirect('/admin');
});

router.get('/', async function(req, res, next) {
	res.render('admin/index');
});

router.get('/email', async function(req, res, next) {
	var page = parseInt(req.params['page'] || '1');

	var sentEmails = await email.getSentEmails(page);

	res.render('admin/email', { sentEmails });
});

router.get('/creators', async function(req, res, next) {
	var creators = await Creator.findAll({ include: User });
	res.render('admin/creators/index', { creators });
});

router.get('/creators/:id', async function(req, res, next) {
	var creator = await Creator.findOne({ where: { id: req.params.id }});
	if(!creator) {
		res.status(404).send('Creator not found');
		return;
	}
	res.render('admin/creators/show', { creator });
});

router.post('/creators/:id/delete', csrf.validateToken, async function(req, res, next) {
	var creator = await Creator.findOne({ where: { id: req.params.id }, include: User });
	if(!creator) {
		res.status(404).send('Creator not found');
		return;
	}
	var codes = creator.User.OneTimeCodes;
	await sequelize.transaction(async t => {
		await sequelize.query('delete from Follows where creatorid = :creatorid', { replacements: { creatorid: creator.id } });
		await sequelize.query('delete from CreatorCategories where creatorid = :creatorid', { replacements: { creatorid: creator.id } });
		await creator.destroy({ transaction: t});
		await sequelize.query('delete from OneTimeCodes where userid = :userid', { replacements: { userid: creator.userId } });
		await sequelize.query('delete from Follows where userid = :userid', { replacements: { userid: creator.userId } });
		await creator.User.destroy({ transaction: t });
	});
	
	req.flash.notice = `${creator.name} was deleted successfully.`;
	res.redirect('/admin/creators');
});

router.get('/users', async function(req, res, next) {
	var users = await User.findAll({ include: Creator });
	res.render('admin/users/index', { users });
});

router.get('/users/:id', async function(req, res, next) {
	var user = await User.findOne({ where: { id: req.params.id }});
	if(!user) {
		res.status(404).send('User not found');
		return;
	}
	res.render('admin/users/show', { user });
});

router.post('/users/:id/delete', csrf.validateToken, async function(req, res, next) {
	var user = await User.findOne({ where: { id: req.params.id } });
	if(!user) {
		res.status(404).send('User not found');
		return;
	}
	
	await sequelize.transaction(async t => {
		if(user.creatorId) {
			await sequelize.query('delete from Follows where creatorid = :creatorid', { replacements: { creatorid: user.creatorId } });
			await sequelize.query('delete from CreatorCategories where creatorid = :creatorid', { replacements: { creatorid: user.creatorId } });
			await sequelize.query('delete from Creators where id = :creatorid', { replacements: { creatorid: user.creatorId } });
		}
		
		await sequelize.query('delete from OneTimeCodes where userid = :userid', { replacements: { userid: user.id } });
		await sequelize.query('delete from Follows where userid = :userid', { replacements: { userid: user.id } });
		await user.destroy({ transaction: t });
	});
	
	req.flash.notice = `${user.email} was deleted successfully.`;
	res.redirect('/admin/users');
});

//#########################################################################
// Utilities
//#########################################################################
router.get('/utils/hashPassword', function(req, res, next) {
	res.render('admin/utils/hashPassword');
});
router.post('/utils/hashPassword', function(req, res, next) {
	res.send(auth.hashPassword(req.body.password));
})

module.exports = router;