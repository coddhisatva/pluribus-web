'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Guild extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Guild.belongsTo(models.User);
      Guild.hasMany(models.GuildFollow);
      Guild.hasMany(models.GuildCategory);
      Guild.hasMany(models.GuildPledge);
      Guild.hasMany(models.GuildCategory);
      Guild.hasMany(models.GuildCreator);
    }

    getProfilePhotoCssClass() {
      if(this.subscriberNum < 1) return "";
      if(this.subscriberNum < 11) return "gold-subscriber";
      if(this.subscriberNum < 101) return "silver-subscriber";
      if(this.subscriberNum < 1001) return "bronze-subscriber";
      return "";
    }
  }
  Guild.init({
    userId: DataTypes.INTEGER,
    photo: DataTypes.STRING,
    name: DataTypes.STRING,
    about: DataTypes.STRING,
    policy: DataTypes.STRING,
    website: DataTypes.STRING,
    socialProfiles: DataTypes.STRING,
    displaySupporterCount: DataTypes.BOOLEAN,
    displayPledgeTotal: DataTypes.BOOLEAN,
    publicProfile: DataTypes.BOOLEAN,
    inviteCode: { type: DataTypes.STRING, unique: true },
    stripeSubscriptionId: DataTypes.STRING,
    subscriptionAmount: DataTypes.INTEGER,
    subscriptionCreated: DataTypes.DATE,
    subscriberNum: DataTypes.INTEGER,
    stripeConnectedAccountId: DataTypes.STRING,
    stripeConnectedAccountOnboarded: DataTypes.BOOLEAN,
    maxAllowedCreators: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
    creatorApprovalPercentage: { type: DataTypes.DECIMAL(3,2), allowNull: false, defaultValue: 0.7, validate: { min: 0.0, max: 1.0 } }
  }, {
    sequelize,
    modelName: 'Guild',
  });

  return Guild;
};