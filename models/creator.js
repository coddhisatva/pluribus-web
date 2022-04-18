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
    }
  }
  Creator.init({
    userId: DataTypes.INTEGER,
    hasPhoto: DataTypes.BOOLEAN,
    name: DataTypes.STRING,
    about: DataTypes.STRING,
    website: DataTypes.STRING,
    socialProfiles: DataTypes.STRING,
    displaySupporterCount: DataTypes.BOOLEAN,
    publicProfile: DataTypes.BOOLEAN,
  }, {
    sequelize,
    modelName: 'Creator',
  });

  return Creator;
};