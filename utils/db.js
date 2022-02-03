const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('pluribus', 'pluribus-web', 'pluribus-web', {
	host: 'localhost',
	dialect: 'mysql'
});

module.exports = sequelize;