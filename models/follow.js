'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Follow extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Follow.belongsTo(models.Creator);
      Follow.belongsTo(models.User);
    }
  }
  Follow.init({
    creatorId: { type: DataTypes.INTEGER, primaryKey: true },
    userId: { type: DataTypes.INTEGER, primaryKey: true }
  }, {
    sequelize,
    modelName: 'Follow'
  });
  return Follow;
};