'use strict';

module.exports = {
	async up (queryInterface, Sequelize) {
		/**
		 * Add altering commands here.
		 *
		 * Example:
		 * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
		 */
		await queryInterface.sequelize.transaction(t => {
			return Promise.all([
				queryInterface.addColumn('Creators', 'photo', {
					type: Sequelize.STRING,
					allowNull: true
				}, { transaction: t }),
				queryInterface.addColumn('Creators', 'website', {
					type: Sequelize.STRING,
				}, { transaction: t }),
				queryInterface.addColumn('Creators', 'socialProfiles', {
					type: Sequelize.STRING,
				}, { transaction: t }),
				queryInterface.addColumn('Creators', 'displaySupporterCount', {
					type: Sequelize.BOOLEAN,
					allowNull: false
				}, { transaction: t }),
				queryInterface.addColumn('Creators', 'publicProfile', {
					type: Sequelize.BOOLEAN,
					allowNull: false
				}, { transaction: t }),

				queryInterface.createTable('CreatorCategories', {
					creatorId: {
						type: Sequelize.INTEGER,
						references: {
							model: 'Creators',
							key: 'id'
						}
					},
					category: {
						type: Sequelize.STRING,
						allowNull: false
					},
					createdAt: {
						allowNull: false,
						type: Sequelize.DATE
					},
					updatedAt: {
						allowNull: false,
						type: Sequelize.DATE
					}
				}),
			]);
		});

		// Prevent duplicate categories
		await queryInterface.addIndex('CreatorCategories', {
			fields: [ 'creatorId', 'category' ],
			unique: true
		})
	},

	async down (queryInterface, Sequelize) {
		/**
		 * Add reverting commands here.
		 *
		 * Example:
		 * await queryInterface.dropTable('users');
		 */
		return queryInterface.sequelize.transaction(t => {
			return Promise.all([
				queryInterface.removeColumn('Creators', 'photo', { transaction: t }),
				queryInterface.removeColumn('Creators', 'website', { transaction: t }),
				queryInterface.removeColumn('Creators', 'socialProfiles', { transaction: t }),
				queryInterface.removeColumn('Creators', 'displaySupporterCount', { transaction: t }),
				queryInterface.removeColumn('Creators', 'publicProfile', { transaction: t }),

				queryInterface.dropTable('CreatorCategories')
			]);
		});
	}
};
