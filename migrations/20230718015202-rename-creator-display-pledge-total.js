'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.renameColumn('Creators', 'displayPledges', 'displayPledgeTotal');
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.renameColumn('Creators', 'displayPledgeTotal', 'displayPledges');
  }
};
