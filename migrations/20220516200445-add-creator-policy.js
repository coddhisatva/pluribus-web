'use strict';

module.exports = {
	async up (queryInterface, Sequelize) {
		await queryInterface.addColumn('Creators', 'policy', {
			type: Sequelize.STRING,
			allowNulls: true
		});
	},

	async down (queryInterface, Sequelize) {
		await queryInterface.removeColumn('Creators', 'policy');
	}
};
