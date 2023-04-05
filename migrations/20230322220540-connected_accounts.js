'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('Creators', 'stripeConnectedAccountId', Sequelize.DataTypes.STRING);
    await queryInterface.addColumn('Creators', 'stripeConnectedAccountOnboarded', Sequelize.DataTypes.BOOLEAN);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('Creators', 'stripeConnectedAccountId');
    await queryInterface.removeColumn('Creators', 'stripeConnectedAccountOnboarded');
  }
};
