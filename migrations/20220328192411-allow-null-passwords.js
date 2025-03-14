'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Allow null passwords
     */
    await queryInterface.changeColumn('Users', 'password', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.sequelize.query('update Users set password = "not-set" where password is null;');

    await queryInterface.changeColumn('Users', 'password', {
      type: Sequelize.STRING,
      allowNull: false
    });
  }
};
