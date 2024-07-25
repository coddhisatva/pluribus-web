'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class GuildFollow extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      GuildFollow.belongsTo(models.Guild);
      GuildFollow.belongsTo(models.User);
    }
  }
  GuildFollow.init({
    guildId: { type: DataTypes.INTEGER, primaryKey: true },
    userId: { type: DataTypes.INTEGER, primaryKey: true }
  }, {
    sequelize,
    modelName: 'GuildFollow'
  });
  return GuildFollow;
};