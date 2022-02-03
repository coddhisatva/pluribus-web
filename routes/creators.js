var express = require('express');
var router = express.Router();
var db = require('../utils/db');

router.get('/', function(req, res, next) {
	db.query('select * from creators', function(err, rows, fields) {
		if(err) throw err;

		//console.log('rows', rows);
		res.render('creators/index', { title: 'Creators', creators: rows });

	});
});

router.get('/:id', function(req, res, next) {
	db.query('select * from creators where id = ?', [ req.params.id ], function(err, rows, fields) {
		if(err) throw err;

		var creator = rows[0];
		res.render('creators/show', { title: creator.name, creator });
	});
});

module.exports = router;