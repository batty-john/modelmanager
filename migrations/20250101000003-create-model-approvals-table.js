'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('model_approvals', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      shootId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'shoots',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      modelType: {
        type: Sequelize.ENUM('adult', 'child'),
        allowNull: false
      },
      modelId: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      approvalStatus: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Add unique index
    await queryInterface.addIndex('model_approvals', {
      fields: ['shootId', 'modelType', 'modelId'],
      unique: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('model_approvals');
  }
}; 