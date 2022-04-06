'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PrelaunchEmail extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  PrelaunchEmail.init({
    email: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'PrelaunchEmail',
  });
  return PrelaunchEmail;
};