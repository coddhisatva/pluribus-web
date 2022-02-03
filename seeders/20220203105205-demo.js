'use strict';

const creator = require("../models/creator");
const user = require("../models/user");

const { QueryTypes } = require('sequelize');

module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
    */

    // Create a date that MySQL likes (yyyy-MM-dd hh:mm:ss)
    // There has to be an easier way to do this.
    var d = new Date();
    d = d.getFullYear() + '-' + String(d.getMonth()).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
      + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
      + ':' + String(d.getSeconds()).padStart(2, '0');

    await queryInterface.bulkInsert('Users', [{
      email: 'joerogan@jre.com',
      password: 'joerogan',
      createdAt: d,
      updatedAt: d
    },
    {
      email: 'harrybergeron@substack.com',
      password: 'harrybergeron',
      createdAt: d,
      updatedAt: d
    },
    {
      email: 'test@pluribus.com',
      password: 'test',
      createdAt: d,
      updatedAt: d
    }]);

    var [userIds,] = await queryInterface.sequelize.query("select id from users where email in ('joerogan@jre.com','harrybergeron@substack.com')", { type: QueryTypes.select });
    console.log(userIds);

    var creators = [
      { userId: userIds[1].id, name: 'Joe Rogan', about: 'The Joe Rogan Experience podcast', createdAt: d, updatedAt: d },
      { userId: userIds[0].id, name: 'Harry Bergeron', about: 'Writing American Alchemy at harrybergeron.substack.com', createdAt: d, updatedAt: d },
    ];

    console.log(creators);
    await queryInterface.bulkInsert('Creators', creators);
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */

    await queryInterface.sequelize.query("delete from creators where userId in (select id from users where email in ('joerogan@jre.com','harrybergeron@substack.com','test@pluribus.com'))");
    await queryInterface.sequelize.query("delete from users where email in ('joerogan@jre.com','harrybergeron@substack.com','test@pluribus.com')");
  }
};
