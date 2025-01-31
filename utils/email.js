const nodemailer = require('nodemailer');
const config = require('../config/email');
const fs = require('fs/promises');

const env = process.env.NODE_ENV || 'development';
const emailConfig = config[env];

var email = {
	dir: process.env.NODE_ENV === 'test' ? 'data/test/email' : 'data/email',
	send: async function(to, subject, text) {
		// In test mode, just log the email
		if (process.env.NODE_ENV === 'test') {
			// Ensure directory exists
			const fs = require('fs').promises;
			await fs.mkdir(this.dir, { recursive: true });
			console.log('Sending test email:', { to, subject, text });
			// Save email for test verification
			const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
			await fs.writeFile(
				`${this.dir}/${timestamp}-${Math.random().toString(36).substring(7)}.json`,
				JSON.stringify({ to, subject, text })
			);
			return;
		}

		// Real email sending for other environments
		var transporter = nodemailer.createTransport(emailConfig);
		await transporter.sendMail({
			from: emailConfig.from,
			to: to,
			subject: subject,
			html: text,
			text: text.text || text
		});
	},

	getSentEmails: async function(page, pageSize) {
		if(page == undefined || page < 1) {
			page = 1;
		}

		if(pageSize == undefined || pageSize < 1) {
			pageSize = 25;
		}

		var files = await fs.readdir(email.dir);
		files = await Promise.all(files.map(async f => {
			return {
				name: f,
				created: (await fs.stat(email.dir + '/' + f)).ctimeMs
			}
		}));

		files.sort((a, b) => a.created > b.created ? -1 : 1 );

		// Filter .json files only
		for(var i = 0; i < files.length; i++) {
			if(!files[i].name.endsWith('.json')) {
				files.splice(i, 1);
				i--;
			}
		}

		var result = { emails: [], page, totalPages: Math.ceil(files.length / pageSize) }; 
		var startI = (page-1) * pageSize;
		for(var i = startI; i < files.length && i < startI + pageSize; i++) {
			var file = files[i].name;

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
	},

	clearTestEmails: async function() {
		if (process.env.NODE_ENV !== 'test') {
			throw new Error('clearTestEmails can only be called in test environment');
		}
		try {
			await fs.rm(this.dir, { recursive: true, force: true });
			await fs.mkdir(this.dir, { recursive: true });
		} catch (err) {
			console.error('Error clearing test emails:', err);
		}
	}
};

module.exports = email;