'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Creators', 'displayPledges', Sequelize.BOOLEAN);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Creators', 'displayPledges');
  }
};
