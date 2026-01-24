// routes/frp.routes.js
const router = require("express").Router();
const frp = require("../controllers/frp.controller");
const authRequired = require("../middleware/authRequired");

router.post("/design", frp.design);

// ✅ calcule + save (USER connecté obligatoire)
router.post("/designsave", authRequired, frp.designAndSave);

// ✅ historique (USER connecté obligatoire)
router.get("/calculations", authRequired, frp.list);

module.exports = router;
