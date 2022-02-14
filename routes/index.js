var express = require('express');
const { redirect } = require('express/lib/response');
var router = express.Router();
var { Creator } = require('../models');


/* GET home page. */
router.get('/', async function(req, res, next) {

  // If the user is logged in, take them to their home screen
  if(req.authUser != null) {
    res.redirect('/users/home');
    return;
  }

  // Generic home page
  creatorCount = await Creator.count();
  res.render('index', { creatorCount });
});

module.exports = router;
