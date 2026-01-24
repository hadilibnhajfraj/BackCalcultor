// controllers/frp.controller.js
const { computeAll } = require("../compute/frp");
const { FrpCalculation } = require("../models");

exports.designAndSave = async (req, res) => {
  try {
    const payload = req.body || {};
    const out = computeAll(payload);

    const userId = req.user?.id ?? req.user?.sub ?? null;

    const row = await FrpCalculation.create({
      userId,
      elementType: out.elementType,
      projectName: payload.projectName ?? null,
      reference: payload.reference ?? null,
      inputs: out.inputs,
      outputs: out,
    });

    return res.json({ ok: true, id: row.id, data: out });
  } catch (e) {
    console.error("Error in designAndSave:", e);
    return res.status(400).json({ ok: false, error: e.message || "Erreur de calcul" });
  }
};



exports.list = async (req, res) => {
  const userId = req.user.id; // ✅
  const rows = await FrpCalculation.findAll({
    where: { userId },
    order: [["created_at", "DESC"]],
    limit: 50,
  });
  return res.json({ ok: true, data: rows });
};
