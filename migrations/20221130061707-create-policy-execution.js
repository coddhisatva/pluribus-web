'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('PolicyExecutions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      creatorId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Creators',
          key: 'id'
        }
      },
      reason: {
        type: Sequelize.STRING
      },
      executedAt: {
        type: Sequelize.DATE
      },
      processedAt: {
        type: Sequelize.DATE
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

    await queryInterface.createTable('PolicyExecutionSupporters', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      policyExecutionId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'PolicyExecutions',
          key: 'id'
        }
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      pledgeId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Pledges',
          key: 'id'
        }
      },
      agree: {
        type: Sequelize.BOOLEAN
      },
      respondedAt: {
        type: Sequelize.DATE
      },
      feedback: {
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
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('PolicyExecutionSupporters');
    await queryInterface.dropTable('PolicyExecutions');
  }
};