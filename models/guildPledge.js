'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class GuildPledge extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      GuildPledge.belongsTo(models.User);
      GuildPledge.belongsTo(models.Guild);
    }
  }
  GuildPledge.init({
    userId: DataTypes.INTEGER,
    guildId: DataTypes.INTEGER,
    frequency: DataTypes.STRING,
    amount: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'GuildPledge'
  });
  return GuildPledge;
};