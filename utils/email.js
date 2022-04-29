const nodemailer = require('nodemailer');
const emailConfig = require('../config/email');
const fs = require('fs/promises');

var email = {
	dir: 'data/email',
	send: async function(env, message) {
		var emailer = nodemailer.createTransport(emailConfig[env]);
		var info = await emailer.sendMail(message);

		// Save the email
		var date = new Date();
		var timestamp = date.getFullYear() + String(date.getMonth()).padStart(2, '0') + String(date.getDate()).padStart(2, '0')
		+ String(date.getHours()).padStart(2, '0') + String(date.getMinutes()).padStart(2, '0')
		+ String(date.getSeconds()).padStart(2, '0');

		var filename = timestamp + '-' + message.to + '.json';
		await fs.mkdir(email.dir, { recursive: true });
		message.info = info;
		await fs.writeFile(email.dir + '/' + filename, JSON.stringify(message));		

		return info;
	},

	getSentEmails: async function(page, pageSize) {
		if(page == undefined || page < 1) {
			page = 1;
		}

		if(pageSize == undefined || pageSize < 1) {
			pageSize = 25;
		}

		var files = await fs.readdir(email.dir);

		// Filter .json files only
		for(var i = 0; i < files.length; i++) {
			if(!files[i].endsWith('.json')) {
				files.splice(i, 1);
				i--;
			}
		}

		var result = { emails: [], page, totalPages: Math.ceil(files.length / pageSize) }; 
		var startI = (page-1) * pageSize;
		for(var i = startI; i < files.length && i < startI + pageSize; i++) {
			var file = files[i];

			var json = await fs.readFile(email.dir + '/' + file, { encoding: 'utf8' });
			var sentEmail = JSON.parse(json);
			var timestamp = file.split('-', 1)[0];
			var year = parseInt(timestamp.slice(0, 4));
			var month = parseInt(timestamp.slice(4, 6));
			var day = parseInt(timestamp.slice(6, 8));
			var hour = parseInt(timestamp.slice(8, 10));
			var minute = parseInt(timestamp.slice(10, 12));
			var sec = parseInt(timestamp.slice(12, 14));
			sentEmail.sent = new Date(year, month, day, hour, minute, sec);

			result.emails.push(sentEmail);
		}

		return result;
	}
};

module.exports = email;