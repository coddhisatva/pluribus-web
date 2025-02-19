# Pluribus

A platform enabling creators to establish crowdfunding protection against cancellation through a unique conditional pledge system. Supporters commit funds that are only processed if specific cancellation criteria are met and community voting thresholds are reached.

## Project Overview

Pluribus implements a novel approach to creator protection:

1. **Conditional Pledge System**: Creators define specific cancellation scenarios, and supporters pledge funds that are only processed if those scenarios occur
2. **Hold-Based Payment Processing**: Uses Stripe's payment hold functionality to secure pledges without immediate processing
3. **Democratic Activation**: When a creator activates pledges, a 7-day voting period begins
4. **Automated Resolution**: Pledges are automatically processed or released based on supporter voting (>50% threshold)
5. **Subscription Management**: Handles recurring pledges and platform subscription fees

## Technical Architecture

### Core Systems
- **Payment Processing**: Stripe integration with custom hold management
- **Notification System**: Event-driven email notifications via SendGrid
- **Voting Engine**: Time-based voting system with automatic resolution
- **Test Infrastructure**: Comprehensive test suite with mocked external services
- **Authentication System**: User roles (admin/creator/supporter) with secure password hashing
- **Policy Management**: Custom cancellation scenario definitions and execution
- **Database Migrations**: Versioned schema changes with Sequelize

### Tech Stack
- **Backend**: Node.js/Express
- **Database**: MySQL with Sequelize ORM
- **Infrastructure**: Docker containerization
- **External Services**: 
  - Stripe for payment processing and subscription management
  - SendGrid for transactional emails
  - PM2 for process management
- **Development Tools**:
  - Docker Compose for local development
  - Jest for unit and integration testing
  - Supertest for API endpoint testing
  - Mock service workers for external API simulation
  - Environment-based configurations

### Prerequisites
- Node.js v14+
- Docker and Docker Compose
- Git

### Local Environment

```sh
# Clone and setup
git clone https://github.com/coddhisatva/pluribus-web.git
cd pluribus-web
cp .env.example .env  # Configure your environment variables

# Start services
docker compose up -d

# Install dependencies and setup database
npm install
npx sequelize db:migrate
npx sequelize-cli db:seed:all

# Start development server
npm run devstart  # Runs on http://localhost:3000
```

### Testing

```sh
# Reset test database
docker compose exec db mysql -u root -pgoop -e "DROP DATABASE IF EXISTS pluribus_test; CREATE DATABASE pluribus_test; GRANT ALL PRIVILEGES ON pluribus_test.* TO 'pluribus-web'@'%';"

# Run test suite
NODE_ENV=test npm run test

# Run specific test file
NODE_ENV=test npm run test test/routes/creators.js
```

## Key Implementation Details

### Payment Processing
- Implements Stripe's payment intent API for hold functionality
- Custom webhook handling for payment state management
- Automatic capture/release based on voting outcomes

### Database Schema
- Sequelize migrations for version control
- Optimized indexes for voting and pledge queries
- Robust foreign key relationships

### Testing Strategy
- Integration tests for critical payment flows
- Mocked external services in test environment
- Automated test data seeding
- Dedicated test scripts for:
  - Email notification verification
  - Policy activation flows
  - User role management
  - Pledge lifecycle testing
- Separate test database with automated setup/teardown
- Environment-specific configurations for test isolation

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.