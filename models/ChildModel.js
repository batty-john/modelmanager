const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

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
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  timestamps: true,
});

module.exports = ChildModel; 