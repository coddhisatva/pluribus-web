module.exports = {
  accounts: {
    create: async () => ({ id: 'acct_test123' }),
    retrieve: async () => ({ charges_enabled: true })
  },
  paymentIntents: {
    create: async () => ({ 
      id: 'pi_test123',
      client_secret: 'pi_test123_secret' 
    })
  },
  products: {
    retrieve: async () => ({
      id: 'prod_test123',
      default_price: {
        id: 'price_test123',
        unit_amount: 1000 // $10.00
      }
    })
  },
  setupIntents: {
    create: async () => ({
      id: 'seti_test123',
      client_secret: 'seti_test123_secret'
    }),
    retrieve: async () => ({
      payment_method: {
        id: 'pm_test123',
        card: {
          brand: 'visa',
          last4: '4242',
          exp_month: 12,
          exp_year: 2025
        },
        metadata: {
          nickname: 'Test Card',
          firstName: 'Test',
          lastName: 'User'
        }
      }
    })
  },
  customers: {
    create: async () => ({
      id: 'cus_test123'
    })
  }
}; 