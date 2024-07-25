'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class GuildCreatorVote extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      //GuildCreatorVote.belongsTo(models.GuildCreator, { as: 'guildCreator', foreignKey: ['guildId', 'creatorId'] });
      //GuildCreatorVote.belongsTo(models.Creator, { as: 'votingCreator', foreignKey: 'votingCreatorId' });
    }
  }
  GuildCreatorVote.init({
    guildId: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
    creatorId: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
    votingCreatorId: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
    vote: { type: DataTypes.ENUM('yea', 'nay'), defaultValue: 'yea', allowNull: false, validate: { isIn: [[ 'yea', 'nay' ]] } }, 
    votedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    sequelize,
    modelName: 'GuildCreatorVote',
  });

  return GuildCreatorVote;
};