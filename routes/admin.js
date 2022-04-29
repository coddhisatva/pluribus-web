const express = require('express');
const router = express.Router();
const auth = require('../utils/auth');
const credentials = require('../config/credentials');
const email = require('../utils/email');

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

router.post('/login', function(req, res, next) {
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