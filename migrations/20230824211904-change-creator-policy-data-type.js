'use strict';

module.exports = {
	async up(queryInterface, Sequelize) {
		queryInterface.changeColumn('Creators', 'policy', {
			type: Sequelize.TEXT,
			allowNull: true
		});
	},

	async down(queryInterface, Sequelize) {
		queryInterface.changeColumn('Creators', 'policy', {
			type: Sequelize.STRING,
			allowNulls: true
		});
	}
};
