'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CardPaymentMethod extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      CardPaymentMethod.belongsTo(models.User);
    }
  }
  CardPaymentMethod.init({
    userId: DataTypes.INTEGER,
    stripePaymentMethodId: DataTypes.STRING,
    cardType: DataTypes.STRING,
    last4: DataTypes.STRING,
    expMonth: DataTypes.INTEGER,
    expYear: DataTypes.INTEGER,
    nickname: DataTypes.STRING,
    firstName: DataTypes.STRING,
    lastName: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'CardPaymentMethod',
  });
  return CardPaymentMethod;
};