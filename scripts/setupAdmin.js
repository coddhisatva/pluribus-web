const { User } = require('../models');
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
      where: { email: 'admin@pluribus' }
    });
    console.log('Cleaned up any existing admin user');

    // Create new admin
    const admin = await User.create({
      email: 'admin@pluribus.com',
      password: '10000:ePBmQ8EVAoJbx3m+DkjDChewmuTpS093:XYOYlGYedUrQk8udKZb8jmDJThEMGKi5',
      roles: ['admin']
    });
    console.log('Admin user created successfully');

    console.log('\nYou can now login as admin:');
    console.log('Email: admin@pluribus');
    console.log('Password: test123');

  } catch (err) {
    console.error('Error setting up admin:', err);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  setupAdmin();
}

module.exports = setupAdmin; 