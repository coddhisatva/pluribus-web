require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_DEV_USERNAME,
    password: process.env.DB_DEV_PASSWORD,
    database: "pluribus",
    host: "localhost",
    dialect: "mysql"
  },
  test: {
    username: process.env.DB_TEST_USERNAME,
    password: process.env.DB_TEST_PASSWORD,
    database: "pluribus_test",
    host: "localhost",
    dialect: "mysql"
  },
  production: {
    username: process.env.DB_PROD_USERNAME,
    password: process.env.DB_PROD_PASSWORD,
    database: "pluribus_prod",
    host: "localhost",
    dialect: "mysql",
    dialectOptions: {
      socketPath: "/run/mysqld/mysqld.sock"
    }
  }
} 