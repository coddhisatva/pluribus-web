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
      userId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      creatorId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'Creators',
          key: 'id'
        }
      },
      frequency: {
        type: Sequelize.STRING
      },
      amount: {
        type: Sequelize.INTEGER
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    },{
      uniqueKeys: {
          pledges_unique: {
              fields: ['userid', 'creatorid' ]
          }
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Pledges');
  }
};