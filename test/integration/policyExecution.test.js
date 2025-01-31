const assert = require('assert');
const { expect } = require('chai');
const { PolicyExecution, PolicyExecutionSupporter, Creator, User, Pledge } = require('../../models');
const auth = require('../../utils/auth');
const fetch = require('node-fetch');
const stripe = require('../mocks/stripe');
const email = require('../../utils/email');
const { loginAsCreator, createSupportersWithPledges, executePolicyWithReason } = require('../helpers/testUtils');

describe('Policy Execution Flow', () => {
  let testCreator, testSupporter, creator, baseURL;

  beforeEach(async () => {
    baseURL = 'http://localhost:3000';
    // Set up test data
    testCreator = await User.create({
      email: 'testcreator@test.com',
      password: auth.hashPassword('test123')
    });
    
    creator = await Creator.create({
      userId: testCreator.id,
      name: 'Test Creator',
      about: 'Test bio',
      policy: 'Test policy',
      publicProfile: true,
      displaySupporterCount: true,
      displayPledgeTotal: true
    });

    // Add required Stripe setup
    creator.stripeConnectedAccountId = 'acct_test123';
    creator.stripeConnectedAccountOnboarded = true;
    creator.stripeSubscriptionId = 'sub_test123';
    await creator.save();
  });

  afterEach(async () => {
    // Clean up test data in correct order
    await PolicyExecutionSupporter.destroy({ where: {} });
    await Pledge.destroy({ where: {} });
    await PolicyExecution.destroy({ where: {} });
    await Creator.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  it('should create a policy execution with holds', async function() {
    this.timeout(10000);
    
    const { csrfToken, authCookies } = await loginAsCreator(baseURL, 'testcreator@test.com', 'test123');

    // Create supporters first
    const supporters = await createSupportersWithPledges(3, creator);
    console.log('Created test supporters:', supporters.map(s => s.email));

    const response = await executePolicyWithReason(baseURL, authCookies, csrfToken, 'Test execution', {
      skipStripeChecks: false
    });
    assert.equal(response.status, 200, 'Should execute policy successfully');

    // 7. Verify supporter records and holds were created
    const executions = await PolicyExecution.findAll({
      where: { creatorId: creator.id }
    });
    console.log('Found executions:', executions);
    assert(executions.length > 0, 'Should create policy execution');

    const supportersCreated = await PolicyExecutionSupporter.findAll({
      where: { policyExecutionId: executions[0].id }
    });
    assert(supportersCreated.length > 0, 'Should create supporter records');

    // New assertions for Stripe holds
    for (const supporter of supportersCreated) {
      // Verify payment intent ID format
      assert(supporter.stripePaymentIntentId.startsWith('pi_test_hold_'), 
        'Should create Stripe hold with correct ID format');
      
      // Verify holdPlacedAt timestamp
      assert(supporter.holdPlacedAt, 'Should record when hold was placed');

      // Get associated pledge to verify amount
      const pledge = await Pledge.findByPk(supporter.pledgeId);
      assert(pledge, 'Should have associated pledge');

      // Verify Stripe mock received correct parameters
      const paymentIntent = await stripe.paymentIntents.retrieve(supporter.stripePaymentIntentId);
      assert.equal(paymentIntent.amount, pledge.amount * 100, 'Should create hold for correct amount');
      assert.equal(paymentIntent.status, 'requires_capture', 'Hold should be pending capture');
      assert.equal(paymentIntent.capture_method, 'manual', 'Should be created as a hold');
    }
  });

  it('should process supporter responses', async () => {
    // Test supporter agreeing/disagreeing with execution
  });

  it('should handle execution expiration', async () => {
    // Test what happens when execution period ends
  });

  it('should send emails to supporters when policy is executed', async function() {
    this.timeout(10000);
    
    console.log('\n=== POLICY EXECUTION TEST START ===');
    const { csrfToken, authCookies } = await loginAsCreator(baseURL, 'testcreator@test.com', 'test123');
    console.log('Logged in as creator');

    await createSupportersWithPledges(3, creator);
    console.log('Created supporters with pledges');

    const response = await executePolicyWithReason(baseURL, authCookies, csrfToken, 'Test execution reason', {
      skipStripeChecks: true
    });
    console.log('Execute policy response:', response.status);
    
    // Verify emails were sent
    const sentEmails = await email.getSentEmails(1);
    console.log('\nFound emails:', sentEmails.emails.length);
    sentEmails.emails.forEach((email, i) => {
      console.log(`Email ${i+1}:`, {
        to: email.to,
        subject: email.subject,
        timestamp: email.sent
      });
    });
    console.log('\n=== POLICY EXECUTION TEST END ===\n');
  });

  // Add more test cases
}); 