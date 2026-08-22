'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('survey_responses', {
      id: {
        type:         Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey:   true,
        allowNull:    false,
      },
      respondent_name: { type: Sequelize.STRING, allowNull: true },
      profession:      { type: Sequelize.STRING, allowNull: true },
      age:             { type: Sequelize.STRING, allowNull: true },
      education:       { type: Sequelize.STRING, allowNull: true },
      admin_unit:      { type: Sequelize.STRING, allowNull: true },

      gov_q1:  { type: Sequelize.STRING, allowNull: true },
      gov_q2:  { type: Sequelize.STRING, allowNull: true },
      gov_q3:  { type: Sequelize.STRING, allowNull: true },
      gov_q4:  { type: Sequelize.STRING, allowNull: true },

      conf_q1: { type: Sequelize.STRING, allowNull: true },
      conf_q2: { type: Sequelize.STRING, allowNull: true },
      conf_q3: { type: Sequelize.STRING, allowNull: true },
      conf_q4: { type: Sequelize.STRING, allowNull: true },

      ahli_q1: { type: Sequelize.STRING, allowNull: true },
      ahli_q2: { type: Sequelize.STRING, allowNull: true },
      ahli_q3: { type: Sequelize.STRING, allowNull: true },
      ahli_q4: { type: Sequelize.STRING, allowNull: true },

      state_q1: { type: Sequelize.STRING, allowNull: true },
      state_q2: { type: Sequelize.STRING, allowNull: true },
      state_q3: { type: Sequelize.STRING, allowNull: true },
      state_q4: { type: Sequelize.STRING, allowNull: true },

      raw_data: {
        type:         Sequelize.JSONB,
        allowNull:    true,
        defaultValue: {},
      },

      submitted_at: {
        type:         Sequelize.DATE,
        allowNull:    false,
        defaultValue: Sequelize.NOW,
      },

      createdAt: {
        type:      Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type:      Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Indexes for fast filtering
    await queryInterface.addIndex('survey_responses', ['profession']);
    await queryInterface.addIndex('survey_responses', ['age']);
    await queryInterface.addIndex('survey_responses', ['admin_unit']);
    await queryInterface.addIndex('survey_responses', ['submitted_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('survey_responses');
  },
};
