// scripts/createAdmin.js
require("dotenv").config();
const bcrypt = require("bcrypt");
const { sequelize, User } = require("../models");

async function main() {
  const email = (process.env.ADMIN_EMAIL || "cbitunisia@cbi-tunisia.com").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || "Admin@123456";

  await sequelize.authenticate();

  const password_hash = await bcrypt.hash(password, 10);

  const [user, created] = await User.findOrCreate({
    where: { email },
    defaults: {
      username: process.env.ADMIN_USERNAME || "admin",
      firstname: process.env.ADMIN_FIRSTNAME || "Admin",
      lastname: process.env.ADMIN_LASTNAME || "CBI",
      tel: process.env.ADMIN_TEL || "11111111",
      profession: process.env.ADMIN_PROFESSION || "Administrator",
      company: process.env.ADMIN_COMPANY || "CBI Tunisia",
      country: process.env.ADMIN_COUNTRY || "TN",
      zip: process.env.ADMIN_ZIP || "1000",
      adresse: process.env.ADMIN_ADRESSE || "Tunis",
      password_hash,
      email_verified: true,
      role: "admin",
      last_seen: new Date(),
    },
  });

  if (!created) {
    await user.update({
      role: "admin",
      email_verified: true,
      last_seen: new Date(),
      // si tu veux reset password admin à chaque run, décommente:
      // password_hash,
    });
    console.log("✅ Admin already exists -> updated role to admin:", user.email);
  } else {
    console.log("✅ Admin created:", user.email);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("❌ createAdmin error:", e);
  process.exit(1);
});
