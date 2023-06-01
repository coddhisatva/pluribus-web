'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('Creators', 'subscriberNum', Sequelize.DataTypes.STRING);

    // Unique index on subscriber number
    await queryInterface.addIndex('Creators', {
      fields: [ 'subscriberNum' ],
      unique: true
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('Creators', 'subscriberNum');
  }
};
