'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      User.hasOne(models.Creator);
      User.hasMany(models.Follow);
      User.hasMany(models.OneTimeCode);
      User.hasMany(models.CardPaymentMethod);
      User.hasMany(models.UserInterest);
      User.hasMany(models.Pledge);
      User.hasOne(models.Guild);
    }
  }
  User.init({
    email: DataTypes.STRING,
    password: DataTypes.STRING,
    name: DataTypes.STRING,
    stripeCustomerId: DataTypes.STRING,
    primaryCardPaymentMethodId: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'User',
  });
  
  return User;
};