const sequelize = require('../config/database');

// Import all models
const User = require('./User');
const Client = require('./Client');
const Shoot = require('./Shoot');
const ModelApproval = require('./ModelApproval');
const ChildModel = require('./ChildModel');
const AdultModel = require('./AdultModel');

// Define associations
Client.hasMany(Shoot, {
  foreignKey: 'clientId',
  as: 'shoots'
});

Shoot.belongsTo(Client, {
  foreignKey: 'clientId',
  as: 'client'
});

Shoot.hasMany(ModelApproval, {
  foreignKey: 'shootId',
  as: 'modelApprovals'
});

ModelApproval.belongsTo(Shoot, {
  foreignKey: 'shootId',
  as: 'shoot'
});

ModelApproval.belongsTo(Client, {
  foreignKey: 'clientId',
  as: 'client'
});

// Export all models
module.exports = {
  sequelize,
  User,
  Client,
  Shoot,
  ModelApproval,
  ChildModel,
  AdultModel
}; 