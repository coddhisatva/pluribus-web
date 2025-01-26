const processExpiredPolicyExecutions = require('./tasks/processExpiredPolicyExecutions');

function startScheduler() {
  // Check every 15 minutes
  const FIFTEEN_MINUTES = 15 * 60 * 1000;
  
  setInterval(async () => {
    try {
      await processExpiredPolicyExecutions();
    } catch (error) {
      console.error('Error processing expired policy executions:', error);
    }
  }, FIFTEEN_MINUTES);

  // Also run immediately on startup
  processExpiredPolicyExecutions().catch(error => {
    console.error('Error in initial policy execution check:', error);
  });
}

module.exports = { startScheduler };
