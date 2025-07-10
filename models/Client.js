const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcrypt');

const Client = sequelize.define('Client', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false
  },
  ineligibleBrands: {
    type: DataTypes.TEXT, // JSON string of ineligible brands
    allowNull: true,
    defaultValue: '[]'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'clients',
  timestamps: true
});

// Instance method to check password
Client.prototype.checkPassword = async function(password) {
  return await bcrypt.compare(password, this.passwordHash);
};

// Instance method to get ineligible brands as array
Client.prototype.getIneligibleBrands = function() {
  try {
    return JSON.parse(this.ineligibleBrands || '[]');
  } catch (e) {
    return [];
  }
};

// Instance method to set ineligible brands
Client.prototype.setIneligibleBrands = function(brands) {
  this.ineligibleBrands = JSON.stringify(brands || []);
};

module.exports = Client; 