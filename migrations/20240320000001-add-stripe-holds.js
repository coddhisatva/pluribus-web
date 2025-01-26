'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add fields to PolicyExecutions
    await queryInterface.addColumn('PolicyExecutions', 'expiresAt', {
      type: Sequelize.DATE,
      allowNull: false  // Required field
    });

    await queryInterface.addColumn('PolicyExecutions', 'status', {
      type: Sequelize.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending',
      allowNull: false
    });

    // Add fields to PolicyExecutionSupporters
    await queryInterface.addColumn('PolicyExecutionSupporters', 'stripePaymentIntentId', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('PolicyExecutionSupporters', 'holdPlacedAt', {
      type: Sequelize.DATE,
      allowNull: true
    });

    // Index for faster lookups
    await queryInterface.addIndex('PolicyExecutionSupporters', {
      fields: ['stripePaymentIntentId'],
      unique: true,
      where: {
        stripePaymentIntentId: {
          [Sequelize.Op.ne]: null
        }
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('PolicyExecutions', 'expiresAt');
    await queryInterface.removeColumn('PolicyExecutions', 'status');
    await queryInterface.removeColumn('PolicyExecutionSupporters', 'stripePaymentIntentId');
    await queryInterface.removeColumn('PolicyExecutionSupporters', 'holdPlacedAt');
  }
}; 