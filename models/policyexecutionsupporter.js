'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  /**
   * This model is used to store supporters that were active at the time
   * a policy was executed, along with each supporter's response to the policy execution.
   */
  class PolicyExecutionSupporter extends Model {
    static associate(models) {
      PolicyExecutionSupporter.belongsTo(models.PolicyExecution);
    }
  }
  PolicyExecutionSupporter.init({
    policyExecutionId: DataTypes.INTEGER,
    userId: DataTypes.INTEGER,
    pledgeId: DataTypes.INTEGER,
	  agree: DataTypes.BOOLEAN,
    respondedAt: DataTypes.DATE,
	  feedback: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'PolicyExecutionSupporter',
  });
  return PolicyExecutionSupporter;
};