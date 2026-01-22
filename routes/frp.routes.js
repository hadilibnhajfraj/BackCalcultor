// routes/frp.routes.js
const router = require("express").Router();
const ctrl = require("../controllers/frp.controller");

router.post("/design", ctrl.design);

module.exports = router;
