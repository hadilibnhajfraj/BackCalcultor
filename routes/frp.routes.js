const express = require("express");
const Frp = require("../controllers/frp.controller");
const authRequired = require("../middleware/authRequired"); // <-- ton middleware JWT

const router = express.Router();

router.post("/design", Frp.design); // public
router.post("/designsave", authRequired, Frp.designAndSave); // <-- protégé
router.get("/list", authRequired, Frp.list); // <-- protégé

module.exports = router;
