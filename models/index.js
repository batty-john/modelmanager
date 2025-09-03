const sequelize = require('../config/database');

// Import all models
const User = require('./User');
const Client = require('./Client');
const Shoot = require('./Shoot');
const ModelApproval = require('./ModelApproval');
const ChildModel = require('./ChildModel');
const AdultModel = require('./AdultModel');
const ChildSize = require('./ChildSize');

// Create models object for associations
const models = {
  User,
  Client,
  Shoot,
  ModelApproval,
  ChildModel,
  AdultModel,
  ChildSize
};

// Set up associations if they exist
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

// Define existing associations
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
  AdultModel,
  ChildSize
}; 