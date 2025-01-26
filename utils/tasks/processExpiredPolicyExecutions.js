const { sequelize, PolicyExecution, PolicyExecutionSupporter } = require('../../models');
const { Op } = require('sequelize');
const credentials = require('../../config/credentials');
const stripe = require('stripe')(credentials.stripe.secretKey);

async function processExpiredPolicyExecutions() {
  // Find executions that are about to expire (within next hour)
  const nearingExpiration = await PolicyExecution.findAll({
    where: {
      status: 'pending',
      processedAt: null,
      expiresAt: {
        [Op.between]: [
          new Date(),
          new Date(Date.now() + 60 * 60 * 1000) // Next hour
        ]
      }
    },
    include: [{
      model: PolicyExecutionSupporter,
      required: true
    }]
  });

  for (const execution of nearingExpiration) {
    await sequelize.transaction(async (t) => {
      // Count votes
      const totalVotes = execution.PolicyExecutionSupporters.length;
      const rejections = execution.PolicyExecutionSupporters.filter(s => s.agree === false).length;
      
      // Process based on voting results
      if (rejections / totalVotes < 0.5) {
        execution.status = 'approved';
        
        // Capture all holds
        for (const supporter of execution.PolicyExecutionSupporters) {
          if (!supporter.stripePaymentIntentId) continue;
          
          try {
            await stripe.paymentIntents.capture(supporter.stripePaymentIntentId);
          } catch (error) {
            console.error(`Failed to capture hold for supporter ${supporter.id}:`, error);
          }
        }
      } else {
        execution.status = 'rejected';
        
        // Cancel all holds
        for (const supporter of execution.PolicyExecutionSupporters) {
          if (!supporter.stripePaymentIntentId) continue;
          
          try {
            await stripe.paymentIntents.cancel(supporter.stripePaymentIntentId);
          } catch (error) {
            console.error(`Failed to cancel hold for supporter ${supporter.id}:`, error);
          }
        }
      }

      execution.processedAt = new Date();
      await execution.save({ transaction: t });
    });
  }
}

module.exports = processExpiredPolicyExecutions;
