'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('Creators', 'inviteCode', {
      type: Sequelize.STRING({ length: 28 }),
      allowNulls: true
    });
    queryInterface.sequelize.query('update Creators set inviteCode = TO_BASE64(RANDOM_BYTES(21));');
    queryInterface.changeColumn('Creators', 'inviteCode', {
      type: Sequelize.STRING({ length: 28 }),
      allowNulls: false
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('Creators', 'inviteCode');
  }
};
