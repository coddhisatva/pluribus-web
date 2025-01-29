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
      PolicyExecution.hasMany(models.PolicyExecutionSupporter);
    }
  }
  PolicyExecution.init({
    creatorId: DataTypes.INTEGER,
    reason: DataTypes.STRING,
    executedAt: DataTypes.DATE,
    // A policy execution has finished processing when all supporters have responded or the response period elapses.
    processedAt: DataTypes.DATE,
    // Add new fields
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending',
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'PolicyExecution',
  });
  return PolicyExecution;
};