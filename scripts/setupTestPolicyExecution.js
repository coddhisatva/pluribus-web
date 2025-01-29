const { sequelize } = require('../models');
const setupPolicyExecution = require('../test/helpers/setupPolicyExecution');

async function main() {
  try {
    // First verify connection
    await sequelize.authenticate();
    console.log('Connected to database');
    
    // Clear any existing test data
    const { User, Creator, Pledge, PolicyExecution, PolicyExecutionSupporter } = require('../models');
    await PolicyExecutionSupporter.destroy({ where: {} });
    await PolicyExecution.destroy({ where: {} });
    await Pledge.destroy({ where: {} });
    await Creator.destroy({ where: {} });
    await User.destroy({ where: { email: ['testcreator@test.com', 'testsupporter@test.com'] }});
    
    const result = await setupPolicyExecution();
    console.log('Test policy execution created');
    console.log('Login as supporter with:');
    console.log('Email: testsupporter@test.com');
    console.log('Password: test123');
    
    // Verify creation
    const supporter = await User.findOne({ where: { email: 'testsupporter@test.com' }});
    console.log('Verified supporter created with ID:', supporter.id);
    
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main(); 