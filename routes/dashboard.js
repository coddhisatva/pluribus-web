const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../utils/auth');
const { User, Creator, Follow } = require('../models');
const multer = require('multer');
const upload = multer({ dest: 'uploads/tmp' });
const fs = require('fs/promises');
const path = require('path');
const util = require('../utils/util');
const sharp = require('sharp');

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

router.get('/payments', async function(req, res, next) {
	res.render('dashboard/payments', {});
});

module.exports = router;