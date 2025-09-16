const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ChildSize = sequelize.define('ChildSize', {
  childId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'ChildModels',
      key: 'id'
    }
  },
  size: {
    type: DataTypes.STRING,
    allowNull: false,
  }
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['childId']
    },
    {
      fields: ['size']
    }
  ]
});

// Define associations
ChildSize.associate = function(models) {
  ChildSize.belongsTo(models.ChildModel, {
    foreignKey: 'childId',
    as: 'child'
  });
};

module.exports = ChildSize;
