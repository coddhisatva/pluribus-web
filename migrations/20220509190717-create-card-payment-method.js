'use strict';
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('CardPaymentMethods', {
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: Sequelize.INTEGER
			},
			userId: {
				type: Sequelize.INTEGER
			},
			stripePaymentMethodId: {
				type: Sequelize.STRING
			},
			cardType: {
				type: Sequelize.STRING
			},
			last4: {
				type: Sequelize.STRING
			},
			expMonth: {
				type: Sequelize.INTEGER
			},
			expYear: {
				type: Sequelize.INTEGER
			},
			nickname: {
				type: Sequelize.STRING
			},
			firstName: {
				type: Sequelize.STRING
			},
			lastName: {
				type: Sequelize.STRING
			},
			createdAt: {
				allowNull: false,
				type: Sequelize.DATE
			},
			updatedAt: {
				allowNull: false,
				type: Sequelize.DATE
			}
		});

		await queryInterface.addColumn('Users', 'stripeCustomerId', {
			type: Sequelize.STRING,
			allowNull: true
		});

		await queryInterface.addColumn('Users', 'primaryCardPaymentMethodId', {
			type: Sequelize.INTEGER,
			allowNull: true
		});

	},
	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('CardPaymentMethods');
		await queryInterface.removeColumn('Users', 'stripeCustomerId');
		await queryInterface.removeColumn('Users', 'primaryCardPaymentMethodId');
	}
};