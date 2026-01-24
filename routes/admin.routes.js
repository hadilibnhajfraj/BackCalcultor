const express = require("express");
const authRequired = require("../middleware/authRequired");
const isAdmin = require("../middleware/isAdmin");
const Admin = require("../controllers/admin.controller");

const router = express.Router();

// Route for fetching online users
router.get("/online-users", authRequired, isAdmin, Admin.onlineUsers);

// Route for user management (block, unblock, delete)
router.post("/manage-user", authRequired, isAdmin, Admin.manageUser);

// Other admin routes
router.get("/frp/stats", authRequired, isAdmin, Admin.frpStats);
router.get("/frp/list", authRequired, isAdmin, Admin.frpList);
router.get("/frp/user/:userId", authRequired, isAdmin, Admin.frpByUser);
router.get("/overview", authRequired, isAdmin, Admin.overview);

module.exports = router;
