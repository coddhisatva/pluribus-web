'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class GuildCategory extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      GuildCategory.belongsTo(models.Guild);
    }
  }
  GuildCategory.init({
    guildId: { type: DataTypes.INTEGER, primaryKey: true },
    category: { type: DataTypes.STRING, primaryKey: true }
  }, {
    sequelize,
    modelName: 'GuildCategory',
  });

  return GuildCategory;
};