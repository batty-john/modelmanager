const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ModelApproval = sequelize.define('ModelApproval', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  shootId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'shoots',
      key: 'id'
    }
  },
  modelType: {
    type: DataTypes.ENUM('adult', 'child'),
    allowNull: false
  },
  modelId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  approvalStatus: {
    type: DataTypes.INTEGER, // null = pending, 0 = disapproved, 1 = approved
    allowNull: true,
    defaultValue: null
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'model_approvals',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['shootId', 'modelType', 'modelId']
    }
  ]
});

module.exports = ModelApproval; 