'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add FULLTEXT index to the 'name' column in the 'Creators' table
    await queryInterface.addIndex('Creators', ['name'], {
      name: 'Creators_name_FULLTEXT', // Custom index name for clarity
      type: 'FULLTEXT',
    });

    // Add FULLTEXT index to the 'name' column in the 'Guilds' table
    await queryInterface.addIndex('Guilds', ['name'], {
      name: 'Guilds_name_FULLTEXT', // Custom index name for clarity
      type: 'FULLTEXT',
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove FULLTEXT index from the 'Creators' table
    await queryInterface.removeIndex('Creators', 'Creators_name_FULLTEXT');

    // Remove FULLTEXT index from the 'Guilds' table
    await queryInterface.removeIndex('Guilds', 'Guilds_name_FULLTEXT');
  }
};
