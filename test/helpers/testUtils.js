const fetch = require('node-fetch');
const auth = require('../../utils/auth');
const { User, Pledge } = require('../../models');

async function loginAsCreator(baseURL, email, password) {
  // Get login page to get CSRF token
  const loginPageRes = await fetch(baseURL + '/users/login');
  const loginHtml = await loginPageRes.text();
  const csrfMatch = loginHtml.match(/<input[^>]*name="_csrfToken"[^>]*value="([^"]*)"[^>]*>/);
  const csrfToken = csrfMatch[1];

  // Login
  const loginRes = await fetch(baseURL + '/users/login', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': loginPageRes.headers.raw()['set-cookie'].join('; ')
    },
    redirect: 'manual',
    body: new URLSearchParams({
      email,
      password,
      _csrfToken: csrfToken
    }).toString()
  });

  return {
    csrfToken,
    authCookies: loginRes.headers.raw()['set-cookie']
  };
}

async function createSupportersWithPledges(numSupporters, creator) {
  console.log('Creating', numSupporters, 'supporters for creator', creator.id);

  // Create supporters
  const supporters = await Promise.all(
    Array(numSupporters).fill().map((_, i) => 
      User.create({
        email: `testsupporter${i+1}@test.com`,
        password: auth.hashPassword('test123')
      })
    )
  );
  console.log('Created supporters:', supporters.map(s => s.email));

  // Create their pledges
  const pledges = await Promise.all(supporters.map((supporter, i) => 
    Pledge.create({
      userId: supporter.id,
      creatorId: creator.id,
      amount: 75 + (i * 25),
      frequency: 'one-time'
    })
  ));
  console.log('Created pledges:', pledges.map(p => ({ userId: p.userId, amount: p.amount })));

  return supporters;
}

async function executePolicyWithReason(baseURL, authCookies, csrfToken, reason, options = {}) {
  // Step 1 - Initial page
  await fetch(`${baseURL}/dashboard/execute-policy/1`, {
    headers: { Cookie: authCookies.join('; ') }
  });

  // Step 2 - Enter reason
  await fetch(`${baseURL}/dashboard/execute-policy/2`, {
    headers: { Cookie: authCookies.join('; ') }
  });

  // Step 3 - Submit reason
  await fetch(`${baseURL}/dashboard/execute-policy/3?reason=${encodeURIComponent(reason)}`, {
    headers: { Cookie: authCookies.join('; ') }
  });

  // Step 4 - Execute policy
  return await fetch(`${baseURL}/dashboard/execute-policy/execute`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: authCookies.join('; ')
    },
    body: new URLSearchParams({ 
      _csrfToken: csrfToken, 
      reason,
      skipStripeChecks: options.skipStripeChecks
    }).toString()
  });
}

module.exports = {
  loginAsCreator,
  createSupportersWithPledges,
  executePolicyWithReason
}; 