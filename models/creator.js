'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Creator extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Creator.belongsTo(models.User);
      Creator.hasMany(models.Follow);
      Creator.hasMany(models.CreatorCategory);
      Creator.hasMany(models.Pledge);
    }

    getProfilePhotoCssClass() {
      if(this.subscriberNum < 1) return "";
      if(this.subscriberNum < 11) return "gold-subscriber";
      if(this.subscriberNum < 101) return "silver-subscriber";
      if(this.subscriberNum < 1001) return "bronze-subscriber";
      return "";
    }
  }
  Creator.init({
    userId: DataTypes.INTEGER,
    photo: DataTypes.STRING,
    name: DataTypes.STRING,
    about: DataTypes.STRING,
    policy: DataTypes.STRING,
    website: DataTypes.STRING,
    socialProfiles: DataTypes.STRING,
    displaySupporterCount: DataTypes.BOOLEAN,
    publicProfile: DataTypes.BOOLEAN,
    inviteCode: DataTypes.STRING,
    stripeSubscriptionId: DataTypes.STRING,
    subscriptionAmount: DataTypes.INTEGER,
    subscriptionCreated: DataTypes.DATE,
    subscriberNum: DataTypes.INTEGER,
    stripeConnectedAccountId: DataTypes.STRING,
    stripeConnectedAccountOnboarded: DataTypes.BOOLEAN,
  }, {
    sequelize,
    modelName: 'Creator',
  });

  return Creator;
};