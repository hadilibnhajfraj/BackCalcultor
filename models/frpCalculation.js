module.exports = (sequelize, DataTypes) => {
  const FrpCalculation = sequelize.define(
    "FrpCalculation",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
     userId: {
  type: DataTypes.UUID,
  allowNull: false, // ✅ au lieu de true
  field: "user_id",
},

      elementType: {
        type: DataTypes.ENUM("dalle", "poutre"),
        allowNull: false,
        field: "element_type",
      },
      projectName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "project_name",
      },
      reference: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      inputs: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      outputs: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
    },
    {
      tableName: "frp_calculations",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  FrpCalculation.associate = (models) => {
    if (models.User) {
      FrpCalculation.belongsTo(models.User, { foreignKey: "userId" });
    }
  };

  return FrpCalculation;
};
