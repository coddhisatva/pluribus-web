'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
let config;

if (process.env.DB_DEV_USERNAME) {
  // Use environment variables if available
  config = {
    username: process.env[`DB_${env.toUpperCase()}_USERNAME`],
    password: process.env[`DB_${env.toUpperCase()}_PASSWORD`],
    database: env === 'production' ? 'pluribus_prod' : 
             env === 'test' ? 'pluribus_test' : 'pluribus',
    host: "localhost",
    dialect: "mysql"
  };
  if (env === 'production') {
    config.dialectOptions = {
      socketPath: "/run/mysqld/mysqld.sock"
    };
  }
} else {
  // Fall back to JSON config
  config = require(__dirname + '/../config/db.json')[env];
}

const db = {};

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
