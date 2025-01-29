const assert = require('assert');
const { PolicyExecution, PolicyExecutionSupporter, Creator, User, Pledge } = require('../../models');
const auth = require('../../utils/auth');
const fetch = require('node-fetch');

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

    testSupporter = await User.create({
      email: 'testsupporter@test.com',
      password: auth.hashPassword('test123')
    });

    // Create a pledge
    await Pledge.create({
      userId: testSupporter.id,
      creatorId: creator.id,
      amount: 50,
      frequency: 'one-time'
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
    
    // 1. Get login page to get CSRF token
    const loginPageRes = await fetch(baseURL + '/users/login');
    const loginHtml = await loginPageRes.text();
    const csrfMatch = loginHtml.match(/<input[^>]*name="_csrfToken"[^>]*value="([^"]*)"[^>]*>/);
    const csrfToken = csrfMatch[1];

    // 2. Login as creator
    const loginRes = await fetch(baseURL + '/users/login', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': loginPageRes.headers.raw()['set-cookie'].join('; ')
      },
      redirect: 'manual',
      body: new URLSearchParams({
        email: 'testcreator@test.com',
        password: 'test123',
        _csrfToken: csrfToken
      }).toString()
    });

    const authCookies = loginRes.headers.raw()['set-cookie'];

    // 3. Step 1 - Initial page
    const step1Res = await fetch(baseURL + '/dashboard/execute-policy/1', {
      headers: { 
        Cookie: authCookies.join('; ')
      }
    });

    // 4. Step 2 - Enter reason
    const step2Res = await fetch(baseURL + '/dashboard/execute-policy/2', {
      headers: { 
        Cookie: authCookies.join('; ')
      }
    });

    // 5. Step 3 - Submit reason
    const step3Res = await fetch(baseURL + '/dashboard/execute-policy/3', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: authCookies.join('; ')
      },
      body: new URLSearchParams({
        _csrfToken: csrfToken,
        reason: 'Test execution'
      }).toString()
    });

    // 6. Execute policy
    const executionRes = await fetch(baseURL + '/dashboard/execute-policy/execute', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: authCookies.join('; ')
      },
      body: new URLSearchParams({
        _csrfToken: csrfToken,
        reason: 'Test execution'
      }).toString()
    });

    // Add debug logging
    console.log('Execution response status:', executionRes.status);
    const executionResponseText = await executionRes.text();
    console.log('Execution response:', executionResponseText);

    assert.equal(executionRes.status, 200, 'Should execute policy successfully');

    // 7. Verify supporter records and holds were created
    const executions = await PolicyExecution.findAll({
      where: { creatorId: creator.id }
    });
    console.log('Found executions:', executions);
    assert(executions.length > 0, 'Should create policy execution');

    const supporters = await PolicyExecutionSupporter.findAll({
      where: { policyExecutionId: executions[0].id }
    });
    assert(supporters.length > 0, 'Should create supporter records');
    assert(supporters[0].stripePaymentIntentId, 'Should create Stripe hold');
  });

  it('should process supporter responses', async () => {
    // Test supporter agreeing/disagreeing with execution
  });

  it('should handle execution expiration', async () => {
    // Test what happens when execution period ends
  });

  // Add more test cases
}); 