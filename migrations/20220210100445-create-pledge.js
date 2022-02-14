'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Pledges', {
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
      amount: {
        type: Sequelize.DECIMAL(10,2),
        allowNull: false
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

    // User can only support a creator once
    await queryInterface.addIndex('Pledges', {
      fields: [ 'creatorId', 'userId' ],
      unique: true
    });

    // Index creatorId and userId for faster lookup
    await queryInterface.addIndex('Pledges', { fields: [ 'creatorId' ]});
    await queryInterface.addIndex('Pledges', { fields: [ 'userId' ]});
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Pledges');
  }
};