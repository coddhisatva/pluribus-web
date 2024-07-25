'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class GuildCreator extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      GuildCreator.belongsTo(models.Guild);
      GuildCreator.belongsTo(models.Creator);
      //GuildCreator.hasMany(models.GuildCreatorVote);
    }
  }
  GuildCreator.init({
    guildId: { type: DataTypes.INTEGER, primaryKey: true },
    creatorId: { type: DataTypes.INTEGER, primaryKey: true },
    status: { type: DataTypes.ENUM('requested', 'approved', 'rejected'), defaultValue: 'requested', allowNull: false, validate: { isIn: [[ 'requested', 'approved', 'rejected' ]] } },
    requestedAt: DataTypes.DATE,
    requestExpiresAt: DataTypes.DATE,
    approvedAt: DataTypes.DATE,
    requiredYeaVotes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 }
  }, {
    sequelize,
    modelName: 'GuildCreator',
  });

  return GuildCreator;
};