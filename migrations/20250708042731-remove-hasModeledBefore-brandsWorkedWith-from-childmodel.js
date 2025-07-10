'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.removeColumn('ChildModels', 'hasModeledBefore');
    await queryInterface.removeColumn('ChildModels', 'brandsWorkedWith');
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.addColumn('ChildModels', 'hasModeledBefore', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await queryInterface.addColumn('ChildModels', 'brandsWorkedWith', {
      type: Sequelize.STRING,
      allowNull: true
    });
  }
};
