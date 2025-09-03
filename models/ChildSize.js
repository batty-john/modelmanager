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
  },
  isPrimary: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Indicates if this is the primary/preferred size for the child'
  }
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['childId']
    },
    {
      fields: ['size']
    },
    {
      fields: ['childId', 'isPrimary'],
      unique: true,
      where: {
        isPrimary: true
      }
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
