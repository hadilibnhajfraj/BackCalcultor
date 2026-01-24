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

exports.design = (req, res) => {
  try {
    const out = computeAll(req.body || {});
    return res.json({ ok: true, data: out });
  } catch (e) {
    console.error(e);
    return res.status(400).json({ ok: false, error: e.message });
  }
};

exports.list = async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?.sub ?? null;
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const rows = await FrpCalculation.findAll({
      where: { userId },
      order: [["created_at", "DESC"]],
      limit: 50,
    });

    return res.json({ ok: true, data: rows });
  } catch (e) {
    console.error("Error in list:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

