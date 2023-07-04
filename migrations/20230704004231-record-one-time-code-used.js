'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('OneTimeCodes', 'used', Sequelize.DataTypes.DATE);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('OneTimeCodes', 'used');
  }
};
