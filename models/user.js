// models/user.js
module.exports = (sequelize, DataTypes) => {
  const bcrypt = require("bcrypt");

  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      firstname: { type: DataTypes.STRING(100), allowNull: false },
      lastname: { type: DataTypes.STRING(100), allowNull: false },

      email: {
        type: DataTypes.STRING(254),
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },

      tel: { type: DataTypes.STRING(20), allowNull: false },
      profession: { type: DataTypes.STRING(150), allowNull: false },
      company: { type: DataTypes.STRING(150), allowNull: false },
      country: { type: DataTypes.STRING(100), allowNull: false },
      zip: { type: DataTypes.STRING(20), allowNull: false },
      adresse: { type: DataTypes.STRING(255), allowNull: true },
      code_postal: { type: DataTypes.STRING(10), allowNull: true },

      password_hash: { type: DataTypes.STRING(100), allowNull: false },

      email_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      email_verification_token: { type: DataTypes.STRING(100), allowNull: true },
      email_verification_expires: { type: DataTypes.DATE, allowNull: true },

      // ✅ NEW
      role: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "user" },
      last_seen: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "users",
      underscored: true,
      defaultScope: { attributes: { exclude: ["password_hash"] } },
      scopes: { withSecret: { attributes: { include: ["password_hash"] } } },
    }
  );

  User.prototype.checkPassword = function (pwd) {
    return bcrypt.compare(pwd, this.password_hash);
  };

  return User;
};
