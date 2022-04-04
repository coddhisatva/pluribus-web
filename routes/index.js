var express = require('express');
const { redirect } = require('express/lib/response');
var router = express.Router();
var { Creator } = require('../models');


/**
 * GET /
 * Shows the home page, or redirects the logged-in user to their dashboard
 */ 
router.get('/', async function(req, res, next) {

  // If the user is logged in, take them to their dashboard
  if(req.authUser != null) {
    res.redirect('/users/dashboard');
    return;
  }

  // Home page
  creatorCount = await Creator.count();
  res.render('index', { creatorCount });
});

router.get('/prelaunch', function(req, res, next) {
  res.render('prelaunch');
});

module.exports = router;
