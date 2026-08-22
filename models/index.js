'use strict';
const { Sequelize } = require('sequelize');
const config        = require('../config/database');

const env        = process.env.NODE_ENV || 'development';
const dbConfig   = config[env];

let sequelize;
if (dbConfig.use_env_variable) {
  sequelize = new Sequelize(process.env[dbConfig.use_env_variable], dbConfig);
} else {
  sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    dbConfig
  );
}

const db = {};
db.Sequelize   = Sequelize;
db.sequelize   = sequelize;
db.SurveyResponse = require('./SurveyResponse')(sequelize);

module.exports = db;
