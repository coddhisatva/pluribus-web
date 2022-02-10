var express = require('express');
var router = express.Router();
var { Creator } = require('../models');


/* GET home page. */
router.get('/', async function(req, res, next) {
  creatorCount = await Creator.count();
  res.render('index', { creatorCount });
});

module.exports = router;
