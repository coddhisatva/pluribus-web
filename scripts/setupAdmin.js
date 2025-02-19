const { User, Creator, Pledge } = require('../models');
const auth = require('../utils/auth');

//Sets up Admin (for local dev)
async function setupAdmin() {
  try {
    // Test the password verification
    const testHash = '10000:ePBmQ8EVAoJbx3m+DkjDChewmuTpS093:XYOYlGYedUrQk8udKZb8jmDJThEMGKi5';
    const works = auth.verifyPassword('test123', testHash);
    console.log('Password verification test:', works);

    // Delete existing admin if exists
    await User.destroy({ 
      where: { email: 'admin@pluribus.com' }
    });
    console.log('Cleaned up any existing admin user');

    // Create new admin
    const admin = await User.create({
      email: 'admin@pluribus.com',
      password: '10000:ePBmQ8EVAoJbx3m+DkjDChewmuTpS093:XYOYlGYedUrQk8udKZb8jmDJThEMGKi5',
      roles: ['admin']
    });
    console.log('Admin user created successfully');

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
    console.log('Test creator created successfully');

    // Create test supporter
    const supporter = await User.create({
      email: 'testsupporter@pluribus.com',
      password: auth.hashPassword('test123'),
      name: 'Test Supporter'
    });
    console.log('Test supporter created successfully');

    // Create pledge
    await Pledge.create({
      userId: supporter.id,
      creatorId: creator.id,
      amount: 100,
      frequency: 'one-time'
    });
    console.log('Test pledge created successfully');

    console.log('\nYou can now login as:');
    console.log('Admin - Email: admin@pluribus.com, Password: test123');
    console.log('Creator - Email: testcreator@pluribus.com, Password: test123');
    console.log('Supporter - Email: testsupporter@pluribus.com, Password: test123');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  setupAdmin();
}

module.exports = setupAdmin; 