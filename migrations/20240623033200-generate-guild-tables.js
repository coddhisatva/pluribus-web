'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('Guilds', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      photo: Sequelize.STRING(255),
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      about: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      policy: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      website: {
        type: Sequelize.STRING
      },
      socialProfiles: {
        type: Sequelize.STRING
      },
      displaySupporterCount: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      displayPledgeTotal: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      publicProfile: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      inviteCode: {
        type: Sequelize.STRING,
        unique: true
      },
      stripeSubscriptionId: {
        type: Sequelize.STRING
      },
      subscriptionAmount: {
        type: Sequelize.INTEGER,
      },
      subscriptionCreated: {
        type: Sequelize.DATE
      },
      subscriberNum: {
        type: Sequelize.STRING(255)
      },
      stripeConnectedAccountId: {
        type: Sequelize.STRING(255)
      },
      stripeConnectedAccountOnboarded: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      maxAllowedCreators: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 10
      },
      creatorApprovalPercentage: { 
        type: Sequelize.DECIMAL(3,2),
        allowNull: false,
        defaultValue: 0.7,
        validate: { min: 0.0, max: 1.0 }
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        type: Sequelize.DATE
      }
    });
    await queryInterface.createTable('GuildCategories', {
      guildId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Guilds',
          key: 'id'
        },
        primaryKey: true
      },
      category: {
        type: Sequelize.STRING(255),
        allowNull: false,
        primaryKey: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        type: Sequelize.DATE
      }
    });
    await queryInterface.createTable('GuildCreators', {
      guildId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Guilds',
          key: 'id'
        },
        primaryKey: true
      },
      creatorId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
          model: 'Creators',
          key: 'id'
        }
      },
      status: {
        type: Sequelize.ENUM('requested', 'approved', 'rejected'),
        defaultValue: 'requested',
        allowNull: false,
        validate: { isIn: [[ 'requested', 'approved', 'rejected' ]] } 
      }, 
      requestedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      requestExpiresAt: {
        type: Sequelize.DATE
      },
      approvedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      requiredYeaVotes: { 
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        type: Sequelize.DATE
      }
    });
    await queryInterface.createTable('GuildFollows', {
      guildId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Guilds',
          key: 'id'
        },
        primaryKey: true
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        primaryKey: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false, 
        defaultValue: Sequelize.NOW 
      },
      updatedAt: {
        type: Sequelize.DATE
      }
    });
    await queryInterface.createTable('GuildPledges', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
      },
      guildId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Guilds',
          key: 'id'
        }
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      frequency: {
        type: Sequelize.STRING(255)
      },
      amount: {
        type: Sequelize.INTEGER
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        type: Sequelize.DATE
      }
    });
    await queryInterface.createTable('GuildCreatorVotes', {
      guildId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Guilds',
          key: 'id'
        },
        primaryKey: true
      },
      creatorId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Creators',
          key: 'id'
        },
        primaryKey: true
      },
      votingCreatorId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Creators',
          key: 'id'
        },
        primaryKey: true
      },
      vote: {
        type: Sequelize.ENUM('yea', 'nay'),
        allowNull: false,
        defaultValue: 'yea',
        validate: { isIn: [[ 'yea', 'nay' ]] }
      },
      votedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        type: Sequelize.DATE
      }
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('GuildCategories');
    await queryInterface.dropTable('GuildCreatorVotes');
    await queryInterface.dropTable('GuildCreators');
    await queryInterface.dropTable('GuildFollows');
    await queryInterface.dropTable('GuildPledges');
    await queryInterface.dropTable('Guilds');
  }
};
