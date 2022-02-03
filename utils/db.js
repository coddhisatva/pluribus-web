var mysql = require('mysql');

var db = mysql.createConnection({
	host: 'localhost',
	user: 'pluribus-web',
	password: 'pluribus-web',
	database: 'pluribus'
});

module.exports = db;