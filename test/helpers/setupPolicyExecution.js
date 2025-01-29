const { User, Creator, Pledge, PolicyExecution, PolicyExecutionSupporter, CardPaymentMethod } = require('../../models');
const auth = require('../../utils/auth');

async function setupPolicyExecution() {
  try {
    console.log('Creating test creator...');
    const testCreator = await User.create({
      email: 'testcreator@test.com',
      password: auth.hashPassword('test123'),
      stripeCustomerId: 'cus_test123'
    });
    console.log('Created test creator:', testCreator.id);
    
    // Create payment method
    const paymentMethod = await CardPaymentMethod.create({
      userId: testCreator.id,
      stripePaymentMethodId: 'pm_test123',
      cardType: 'visa',
      last4: '4242'
    });

    // Update user with payment method ID
    testCreator.primaryCardPaymentMethodId = paymentMethod.id;
    await testCreator.save();

    console.log('Creating creator profile...');
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
    console.log('Created creator profile:', creator.id);

    console.log('Creating test supporter...');
    const testSupporter = await User.create({
      email: 'testsupporter@test.com',
      password: auth.hashPassword('test123'),
      stripeCustomerId: 'cus_test456'
    });
    console.log('Created test supporter:', testSupporter.id);

    // Create payment method for supporter
    const supporterPaymentMethod = await CardPaymentMethod.create({
      userId: testSupporter.id,
      stripePaymentMethodId: 'pm_test456',
      cardType: 'visa',
      last4: '4242'
    });

    // Update supporter with payment method ID
    testSupporter.primaryCardPaymentMethodId = supporterPaymentMethod.id;
    await testSupporter.save();

    // Create pledge
    const pledge = await Pledge.create({
      userId: testSupporter.id,
      creatorId: creator.id,
      amount: 50,
      frequency: 'one-time'
    });

    // Create policy execution
    const execution = await PolicyExecution.create({
      creatorId: creator.id,
      reason: 'Test execution',
      executedAt: new Date(),
      expiresAt: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)),
      status: 'pending'
    });

    // Create policy execution supporter with Stripe hold
    const supporter = await PolicyExecutionSupporter.create({
      policyExecutionId: execution.id,
      userId: testSupporter.id,
      pledgeId: pledge.id,
      stripePaymentIntentId: 'pi_test_hold_123',
      holdPlacedAt: new Date()
    });

    return {
      creator: testCreator,
      creatorProfile: creator,
      supporter: testSupporter,
      pledge,
      execution,
      executionSupporter: supporter
    };
  } catch (err) {
    console.error('Error in setupPolicyExecution:', err);
    throw err;
  }
}

module.exports = setupPolicyExecution; 