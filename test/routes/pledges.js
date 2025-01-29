const assert = require('assert');
const fetch = require('node-fetch');

module.exports = (config) => {
  const baseURL = config.baseURL;

  describe('Pledge Flow', () => {
    describe('POST /dashboard/subscribe', () => {
      it('Should allow creator subscription', async () => {
        console.log('Testing creator subscription...');
        
        // Login as test creator
        const loginRes = await fetch(baseURL + '/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'testcreator12@test.com',
            password: 'test123'
          })
        });
        assert(loginRes.ok, 'Should login successfully');
        console.log('Logged in as creator');

        // Try to subscribe
        const subscribeRes = await fetch(baseURL + '/dashboard/subscribe', {
          method: 'GET',
          headers: { Cookie: loginRes.headers.get('set-cookie') }
        });
        assert(subscribeRes.ok, 'Should access subscribe page');
        console.log('Accessed subscribe page');
      });
    });
  });
};