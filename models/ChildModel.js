const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const ChildModel = sequelize.define('ChildModel', {
  childFirstName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  childLastName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  childDOB: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  childGender: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  childWeight: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  childHeight: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  photo: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  childSize: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Primary size for backward compatibility - will be synced with primary ChildSize'
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  timestamps: true,
});

// Define associations
ChildModel.associate = function(models) {
  ChildModel.hasMany(models.ChildSize, {
    foreignKey: 'childId',
    as: 'sizes'
  });
};

module.exports = ChildModel; 
// Associate child models to users for efficient includes
ChildModel.belongsTo(User, { foreignKey: 'userId' });