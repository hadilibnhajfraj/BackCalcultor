const express = require("express");
const router = express.Router();
const { generateBeamPdf } = require("../controllers/pdf.controller");

router.post("/generate-pdf", generateBeamPdf);

module.exports = router;