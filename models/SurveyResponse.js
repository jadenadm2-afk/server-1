'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class SurveyResponse extends Model {
    static associate(models) {}
  }

  SurveyResponse.init({
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },
    respondent_name: { type: DataTypes.STRING, allowNull: true },
    profession:      { type: DataTypes.STRING, allowNull: true },
    age:             { type: DataTypes.STRING, allowNull: true },
    education:       { type: DataTypes.STRING, allowNull: true },
    admin_unit:      { type: DataTypes.STRING, allowNull: true },

    // Governance (gov)
    gov_q1: { type: DataTypes.STRING, allowNull: true },
    gov_q2: { type: DataTypes.STRING, allowNull: true },
    gov_q3: { type: DataTypes.STRING, allowNull: true },
    gov_q4: { type: DataTypes.STRING, allowNull: true },

    // Conflict (conf)
    conf_q1: { type: DataTypes.STRING, allowNull: true },
    conf_q2: { type: DataTypes.STRING, allowNull: true },
    conf_q3: { type: DataTypes.STRING, allowNull: true },
    conf_q4: { type: DataTypes.STRING, allowNull: true },

    // Native Admin (ahli)
    ahli_q1: { type: DataTypes.STRING, allowNull: true },
    ahli_q2: { type: DataTypes.STRING, allowNull: true },
    ahli_q3: { type: DataTypes.STRING, allowNull: true },
    ahli_q4: { type: DataTypes.STRING, allowNull: true },

    // State Role (state)
    state_q1: { type: DataTypes.STRING, allowNull: true },
    state_q2: { type: DataTypes.STRING, allowNull: true },
    state_q3: { type: DataTypes.STRING, allowNull: true },
    state_q4: { type: DataTypes.STRING, allowNull: true },

    // Raw full submission stored as JSONB
    raw_data: {
      type:         DataTypes.JSONB,
      allowNull:    true,
      defaultValue: {},
    },

    submitted_at: {
      type:         DataTypes.DATE,
      allowNull:    false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    sequelize,
    modelName:  'SurveyResponse',
    tableName:  'survey_responses',
    timestamps: true,
  });

  return SurveyResponse;
};
