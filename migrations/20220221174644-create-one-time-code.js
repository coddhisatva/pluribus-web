'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('OneTimeCodes', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      email: {
        type: Sequelize.STRING
      },
      code: {
        type: Sequelize.STRING
      },
      expires: {
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

    // User can only follow a creator once
    await queryInterface.addIndex('OneTimeCodes', {
      fields: [ 'code' ],
      unique: true
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('OneTimeCodes');
  }
};