const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const AdultModel = sequelize.define('Adult', {
  firstName: { type: DataTypes.STRING, allowNull: false },
  lastName: { type: DataTypes.STRING, allowNull: false },
  gender: { type: DataTypes.STRING, allowNull: false },
  size: { type: DataTypes.STRING, allowNull: false },
  photo: { type: DataTypes.STRING, allowNull: true },
  dob: { type: DataTypes.DATEONLY, allowNull: true },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
});

AdultModel.belongsTo(User, { foreignKey: 'userId' });

module.exports = AdultModel; 