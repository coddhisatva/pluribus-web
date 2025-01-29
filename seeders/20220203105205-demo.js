'use strict';

const auth = require('../utils/auth');
const { QueryTypes } = require('sequelize');

/**
 * Create a date-time string that MySQL likes (yyyy-MM-dd hh:mm:ss)
 * @param {Date} date 
 * @returns A date-time string in a format that MySQL likes
 */
function mysqlDatetime(date) {
	return date.toISOString().slice(0, 19).replace('T', ' ');
}


/**
 * Set createdAt, updatedAt timestamps for each of the supplied records.
 * @param {Array} records 
 */
function addTimestamps(records) {
	var now = mysqlDatetime(new Date());
	return records.map(record => ({
		...record,
		createdAt: now,
		updatedAt: now
	}));
}

module.exports = {
	async up (queryInterface, Sequelize) {
		console.log('Inserting test users');
		await queryInterface.bulkInsert('Users', addTimestamps([
		{
			email: 'testcreator12@test.com',
			password: auth.hashPassword('test123')
		}
		]));

		// Get the test user's ID
		const [testUser] = await queryInterface.sequelize.query(
			"SELECT id FROM Users WHERE email = 'testcreator12@test.com'",
			{ type: QueryTypes.SELECT }
		);

		console.log('Creating test creator profile');
		await queryInterface.bulkInsert('Creators', addTimestamps([
			{
				userId: testUser.id,
				name: 'Test Creator',
				about: 'Test Creator Bio',
				publicProfile: true,
				displaySupporterCount: true,
				stripeSubscriptionId: 'sub_test123'
			}
		]));
	},

	async down (queryInterface, Sequelize) {
		// No need for explicit cleanup since DROP DATABASE handles it
	}
};
