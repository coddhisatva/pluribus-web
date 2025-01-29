const { sequelize, PolicyExecution, PolicyExecutionSupporter } = require('../../models');
const { Op } = require('sequelize');
const credentials = require('../../config/credentials');
const stripe = require('stripe')(credentials.stripe.secretKey);

async function processExpiredPolicyExecutions() {
  // Finds executions about to expire
  // Counts votes
  // Either captures or cancels holds based on voting
}

module.exports = processExpiredPolicyExecutions;
