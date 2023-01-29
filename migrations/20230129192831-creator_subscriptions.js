'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'Creators',
      'stripeSubscriptionId',
      Sequelize.DataTypes.STRING,
    );

    await queryInterface.addColumn(
      'Creators',
      'subscriptionAmount',
      Sequelize.DataTypes.INTEGER,
    );

    await queryInterface.addColumn(
      'Creators',
      'subscriptionCreated',
      Sequelize.DataTypes.DATE,
    );
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('Creators', 'stripeSubcriptionId');
    await queryInterface.removeColumn('Creators', 'subscriptionAmount');
    await queryInterface.removeColumn('Creators', 'subscriptionCreated');
  }
};
