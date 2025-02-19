const { User, Creator, Pledge, PolicyExecution, PolicyExecutionSupporter } = require('../models');
const auth = require('../utils/auth');

async function setupDevEmailTest() {
  // Clean up existing data
  await PolicyExecutionSupporter.destroy({ where: {} });
  await Pledge.destroy({ where: {} });
  await PolicyExecution.destroy({ where: {} });
  await Creator.destroy({ where: {} });
  await User.destroy({ where: {} });

  // Create test creator
  const testCreator = await User.create({
    email: 'testcreator@pluribus.com',
    password: auth.hashPassword('test123')
  });
  
  const creator = await Creator.create({
    userId: testCreator.id,
    name: 'Test Creator',
    about: 'Test bio',
    policy: 'Test policy',
    publicProfile: true,
    displaySupporterCount: true,
    displayPledgeTotal: true,
    stripeConnectedAccountId: 'acct_test123',
    stripeConnectedAccountOnboarded: true,
    stripeSubscriptionId: 'sub_test123'
  });

  // Create test supporter
  const supporter = await User.create({
    email: 'testsupporter@pluribus.com',
    password: auth.hashPassword('test123'),
    name: 'Test Supporter'
  });

  // Create pledge
  await Pledge.create({
    userId: supporter.id,
    creatorId: creator.id,
    amount: 100,
    frequency: 'one-time'
  });

  console.log('Setup complete:');
  console.log('Creator login:', testCreator.email);
  console.log('Creator password: test123');
  console.log('\nNow you can:');
  console.log('1. Login as creator');
  console.log('2. Go to dashboard');
  console.log('3. Execute policy');
}

setupDevEmailTest().catch(console.error); 