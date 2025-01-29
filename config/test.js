module.exports = {
  stripe: {
    secretKey: 'sk_test_mock',
    publicKey: 'pk_test_mock'
  },
  email: {
    // Mock email settings for test environment
    host: 'smtp.mock.test',
    port: 587,
    auth: {
      user: 'test@mock.test',
      pass: 'mockpass'
    }
  }
}; 