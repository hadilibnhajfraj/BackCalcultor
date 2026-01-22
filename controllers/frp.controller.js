// controllers/frp.controller.js
const { computeAll } = require("../compute/frp");

exports.design = (req, res) => {
  try {
    const out = computeAll(req.body || {});
    return res.json({ ok: true, data: out });
  } catch (e) {
    console.error(e);
    return res.status(400).json({ ok: false, error: e.message });
  }
};
