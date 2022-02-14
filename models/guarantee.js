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
      Pledge.belongsTo(models.Creator);
      Pledge.belongsTo(models.User);
    }
  }
  Pledge.init({
    creatorId: DataTypes.INTEGER,
    userId: DataTypes.INTEGER,
    amount: DataTypes.DECIMAL(10,2)
  }, {
    sequelize,
    modelName: 'Pledge',
  });
  return Pledge;
};