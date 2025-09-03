'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create ChildSizes table to store multiple sizes per child
    await queryInterface.createTable('ChildSizes', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      childId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'ChildModels',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      size: {
        type: Sequelize.STRING,
        allowNull: false
      },
      isPrimary: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Indicates if this is the primary/preferred size for the child'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Add indexes for better query performance
    await queryInterface.addIndex('ChildSizes', ['childId']);
    await queryInterface.addIndex('ChildSizes', ['size']);
    await queryInterface.addIndex('ChildSizes', ['childId', 'isPrimary']);
    
    // Add unique constraint to ensure only one primary size per child
    await queryInterface.addConstraint('ChildSizes', {
      fields: ['childId', 'isPrimary'],
      type: 'unique',
      name: 'unique_primary_size_per_child',
      where: {
        isPrimary: true
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ChildSizes');
  }
};
