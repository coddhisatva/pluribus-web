'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('PolicyExecutionSupporters', 'stripeCheckoutSessionId', Sequelize.DataTypes.STRING);
    await queryInterface.addColumn('PolicyExecutionSupporters', 'stripeCheckoutSessionPaid', Sequelize.DataTypes.BOOLEAN);

    // Index stripeCheckoutSessionId for faster lookup
		await queryInterface.addIndex('PolicyExecutionSupporters', {
			fields: [ 'stripeCheckoutSessionId' ],
			unique: true
		});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('PolicyExecutionSupporters', 'stripeCheckoutSessionId');
    await queryInterface.removeColumn('PolicyExecutionSupporters', 'stripeCheckoutSessionPaid');
  }
};
