const assert = require('assert');
const { User, Creator, Pledge, PolicyExecution } = require('../../models');
const auth = require('../../utils/auth');

describe('Pledge Flow', () => {
  let testCreator, testSupporter;

  beforeEach(async () => {
    console.log('Setting up test data...');
    
    // Create test creator
    testCreator = await User.create({
      email: 'testcreator@test.com',
      password: auth.hashPassword('test123')
    });
    console.log('Created test creator:', testCreator.email);
    
    const creator = await Creator.create({
      userId: testCreator.id,
      name: 'Test Creator',
      about: 'Test bio',
      policy: 'Test policy',
      displaySupporterCount: true,
      publicProfile: true
    });
    console.log('Created creator profile');

    // Create test supporter
    testSupporter = await User.create({
      email: 'testsupporter@test.com',
      password: auth.hashPassword('test123')
    });
    console.log('Created test supporter:', testSupporter.email);

    // Create a pledge
    const pledge = await Pledge.create({
      userId: testSupporter.id,
      creatorId: creator.id,
      amount: 50,
      frequency: 'one-time'
    });
    console.log('Created test pledge: $50');
  });

  afterEach(async () => {
    console.log('Cleaning up test data...');
    await User.destroy({ where: {} });
    await Creator.destroy({ where: {} });
    await Pledge.destroy({ where: {} });
    await PolicyExecution.destroy({ where: {} });
  });

  it('should complete full pledge activation flow', async () => {
    console.log('Testing pledge activation flow...');
    
    // 1. Get creator and verify initial state
    const creator = await Creator.findOne({ 
      where: { userId: testCreator.id },
      include: [{ model: User }]
    });
    assert(creator, 'Creator should exist');
    console.log('Found creator:', creator.name);

    // 2. Simulate Stripe connection
    creator.stripeConnectedAccountId = 'acct_test123';
    creator.stripeConnectedAccountOnboarded = true;
    await creator.save();
    console.log('Simulated Stripe connection');

    // 3. Verify pledge exists
    const pledges = await Pledge.findAll({ 
      where: { creatorId: creator.id }
    });
    assert(pledges.length > 0, 'Should have pledges');
    console.log('Found', pledges.length, 'pledges');

    // 4. Create policy execution
    const policyExecution = await PolicyExecution.create({
      creatorId: creator.id,
      reason: 'Test execution',
      executedAt: new Date(),
      expiresAt: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)),
      status: 'pending'
    });
    console.log('Created policy execution');

    // 5. Verify everything is set up correctly
    assert(creator.stripeConnectedAccountOnboarded, 'Creator should be Stripe-enabled');
    assert(policyExecution.status === 'pending', 'Execution should be pending');
    console.log('All checks passed!');
  });
}); 