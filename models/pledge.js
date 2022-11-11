'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Pledge extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Pledge.belongsTo(models.User);
      Pledge.belongsTo(models.Creator);
    }
  }
  Pledge.init({
    userId: DataTypes.INTEGER,
    creatorId: DataTypes.INTEGER,
    frequency: DataTypes.STRING,
    amount: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'Pledge',
  });
  return Pledge;
};