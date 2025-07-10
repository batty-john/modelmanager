const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  isAdmin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  parentFirstName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  parentLastName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  parentPhone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  preferredContact: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  facebookProfileLink: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  instagramProfileLink: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  hasModeledBefore: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
  },
  brands: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  resetPasswordToken: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  resetPasswordExpires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  timestamps: true,
});

module.exports = User; 