'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class OneTimeCode extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      OneTimeCode.belongsTo(models.User);
    }
  }
  OneTimeCode.init({
    userId: DataTypes.INTEGER,
    email: DataTypes.STRING,
    code: DataTypes.STRING,
    expires: DataTypes.DATE,
    used: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'OneTimeCode',
  });
  return OneTimeCode;
};