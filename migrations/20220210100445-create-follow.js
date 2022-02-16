'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Follows', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      creatorId: {
        type: Sequelize.INTEGER,
        allowNull:false,
        references: {
          model: 'Creators',
          key: 'id'
        }
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull:false,
        references: {
          model: 'Users',
          key: 'id'
        }
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
    await queryInterface.addIndex('Follows', {
      fields: [ 'creatorId', 'userId' ],
      unique: true
    });

    // Index creatorId and userId for faster lookup
    await queryInterface.addIndex('Follows', { fields: [ 'creatorId' ]});
    await queryInterface.addIndex('Follows', { fields: [ 'userId' ]});
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Follows');
  }
};