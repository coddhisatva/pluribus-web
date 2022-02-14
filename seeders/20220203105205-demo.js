'use strict';

const models = require("../models");
const { QueryTypes } = require('sequelize');
const auth = require('../utils/auth');

/**
 * Create a date-time string that MySQL likes (yyyy-MM-dd hh:mm:ss)
 * @param {Date} date 
 * @returns A date-time string in a format that MySQL likes
 */
function mysqlDatetime(date) {
	return date.getFullYear() + '-' + String(date.getMonth()).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')
	+ ' ' + String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0')
	+ ':' + String(date.getSeconds()).padStart(2, '0');
}

/**
 * Set createdAt, updatedAt timestamps for each of the supplied records.
 * @param {Array} records 
 */
function addTimestamps(records) {
	var d = mysqlDatetime(new Date());
	records.forEach(record => {
		record.createdAt = d,
		record.updatedAt = d
	});
	return records;
}

module.exports = {
	async up (queryInterface, Sequelize) {
		/**
		 * Add seed commands here.
		 *
		 * Example:
		 * await queryInterface.bulkInsert('People', [{
		 *   name: 'John Doe',
		 *   isBetaMember: false
		 * }], {});
		*/

		var d = mysqlDatetime(new Date());

		console.log('Inserting users');
		await queryInterface.bulkInsert('Users', addTimestamps([
		{
			email: 'test@pluribus.com',
			password: auth.hashPassword('test')
		},
		{
			email: 'joerogan@jre.com.invalid',
			password: auth.hashPassword('joerogan')
		},
		{
			email: 'harrybergeron@substack.com.invalid',
			password: auth.hashPassword('harrybergeron')
		},
		{
			email: 'graymirror@substack.com.invalid',
			password: auth.hashPassword('graymirror')
		},
		{
			email: 'eugyppius@substack.com.invalid',
			password: auth.hashPassword('eugyppius')
		},
		{
			email: 'bap@bap.com.invalid',
			password: auth.hashPassword('bap')
		}
		]));


		console.log('Getting user ids');
		var [userIds,] = await queryInterface.sequelize.query("select id from users where email in ('joerogan@jre.com.invalid','harrybergeron@substack.com.invalid','graymirror@substack.com.invalid','eugyppius@substack.com.invalid','bap@bap.com.invalid') order by id", { type: QueryTypes.select });

		//console.log(userIds);
		var creators = [
			{ userId: userIds[0].id, name: 'Joe Rogan', about: 'The Joe Rogan Experience podcast', createdAt: d, updatedAt: d },
			{ userId: userIds[1].id, name: 'Harry Bergeron', about: 'Writing American Alchemy at harrybergeron.substack.com', createdAt: d, updatedAt: d },
			{ userId: userIds[2].id, name: 'Curtis Yarvin', about: 'Writing at greymirror.substack.com', createdAt: d, updatedAt: d },
			{ userId: userIds[3].id, name: 'eugyppius', about: 'Writing A Plague Chronicle at eugyppius.substack.com', createdAt: d, updatedAt: d },
		];

		addTimestamps(creators);

		console.log('Inserting creators');
		await queryInterface.bulkInsert('Creators', creators);

		// Test user supports first 2 creators
		var [creatorIds,] = await queryInterface.sequelize.query("select id from creators limit 2", { type: QueryTypes.select });

		console.log('Getting test user id');
		var testUserId = await queryInterface.sequelize.query("select id from users where email = 'test@pluribus.com'", {
				plain: true, // gets a single row
		type: QueryTypes.select
		});

		//console.log(testUserId);

		var pledges = [ ]
		creatorIds.forEach((creatorId) => {
			pledges.push({ creatorId: creatorId.id, userId: testUserId.id, amount: 10 })
		});
		addTimestamps(pledges);

		console.log('Inserting pledges');
		await queryInterface.bulkInsert('Pledges', pledges);
	},

	async down (queryInterface, Sequelize) {
		/**
		 * Add commands to revert seed here.
		 *
		 * Example:
		 * await queryInterface.bulkDelete('People', null, {});
		 */

		await queryInterface.sequelize.query("delete from pledges where userId = (select id from users where email = 'test@pluribus.com')");
		await queryInterface.sequelize.query("delete from creators where userId in (select id from users where email = 'test@pluribus.com' or email like '%.invalid')");
		await queryInterface.sequelize.query("delete from users where email like 'test@pluribus.com' or email like '%.invalid'");
	}
};
