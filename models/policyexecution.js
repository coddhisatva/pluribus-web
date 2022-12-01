'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PolicyExecution extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      PolicyExecution.belongsTo(models.Creator);
    }
  }
  PolicyExecution.init({
    creatorId: DataTypes.INTEGER,
    reason: DataTypes.STRING,
    executedAt: DataTypes.DATE,
    // A policy execution has finished processing when all supporters have responded or the response period elapses.
    processedAt: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'PolicyExecution',
  });
  return PolicyExecution;
};