'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('PolicyExecutionSupporters', 'pledgeSource', { type: Sequelize.ENUM('creator', 'guild'), allowNull: false, defaultValue: 'creator' });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('PolicyExecutionSupporters', 'pledgeSource');
  }
};
