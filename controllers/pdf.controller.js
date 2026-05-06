const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const expressionParser = require("docxtemplater/expressions.js");
const { exec } = require("child_process");

exports.generateBeamPdf = async (req, res) => {
  try {
    const data = req.body;

    console.log("📦 DATA RECEIVED:", JSON.stringify(data, null, 2));

    const templatePath = path.join(__dirname, "../templates/template.docx");
    const tempDir = path.join(__dirname, "../temp");

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    if (!fs.existsSync(templatePath)) {
      throw new Error("Template DOCX introuvable");
    }

    // ✅ lire template
    const content = fs.readFileSync(templatePath, "binary");
    const zip = new PizZip(content);

    // ✅ 🔥 DOC AVEC PARSER (FIX FINAL)
    const doc = new Docxtemplater(zip, {
  parser: expressionParser,
  delimiters: { start: "{{", end: "}}" }, // 🔥 OBLIGATOIRE
  paragraphLoop: true,
  linebreaks: true,
  nullGetter: () => "",
});

    // 🔥 SAFE DATA
    const safe = (v) => (v === null || v === undefined ? "" : v);

    const templateData = {
      loads: {
        Mu_kNm: safe(data?.loads?.Mu_kNm),
        Vu_kN: safe(data?.loads?.Vu_kN),
      },
      geometry: {
        b_mm: safe(data?.geometry?.b_mm),
        h_mm: safe(data?.geometry?.h_mm),
        d_mm: safe(data?.geometry?.d_mm),
      },
      concrete: {
        fc_MPa: safe(data?.concrete?.fc_MPa),
        eps_cu: safe(data?.concrete?.eps_cu),
      },
      frp: {
        bar_diam_mm: safe(data?.frp_long?.bar_diam_mm),
        nBars: safe(data?.frp_long?.nBars),
        Ef_MPa: safe(data?.frp_long?.Ef_MPa),
        ffu_MPa: safe(data?.frp_long?.ffu_MPa),
        Af_mm2: safe(data?.frp_long?.Af_mm2),
      },
      frp_shear: {
        Afv_mm2: safe(data?.frp_shear?.Afv_mm2),
        s_mm: safe(data?.frp_shear?.s_mm),
        phi_v: safe(data?.frp_shear?.phi_v),
        ffv_MPa: safe(data?.frp_shear?.ffv_MPa),
        theta_deg: safe(data?.frp_shear?.theta_deg),
      },
      service: {
        kb: safe(data?.service?.kb),
        w_lim_mm: safe(data?.service?.w_lim_mm),
      },
    };

    console.log("📄 TEMPLATE DATA:", templateData);

    // ✅ render
    try {
      doc.setData(templateData);
      doc.render();
    } catch (error) {
      console.error("❌ DOCX TEMPLATE ERROR:", error);

      if (error.properties?.errors) {
        error.properties.errors.forEach((e) =>
          console.error("👉 Template issue:", e)
        );
      }

      return res.status(500).json({
        error: "Erreur template DOCX",
        details: error.message,
      });
    }

    const outputDocx = path.join(tempDir, `output_${Date.now()}.docx`);
    const outputPdf = outputDocx.replace(".docx", ".pdf");

    const buf = doc.getZip().generate({ type: "nodebuffer" });
    fs.writeFileSync(outputDocx, buf);

    const libreOfficePath = `"C:\\Program Files\\LibreOffice\\program\\soffice.exe"`;

    exec(
      `${libreOfficePath} --headless --convert-to pdf "${outputDocx}" --outdir "${tempDir}"`,
      (err, stdout, stderr) => {
        if (err) {
          console.error("❌ LIBREOFFICE ERROR:", err);
          console.error(stderr);
          return res.status(500).json({ error: "Conversion PDF échouée" });
        }

        if (!fs.existsSync(outputPdf)) {
          return res.status(500).json({ error: "PDF non généré" });
        }

        console.log("✅ PDF GENERATED");

        res.download(outputPdf, "rapport_poutre.pdf", () => {
          try {
            fs.unlinkSync(outputDocx);
            fs.unlinkSync(outputPdf);
          } catch {}
        });
      }
    );
  } catch (e) {
    console.error("❌ PDF ERROR 👉", e);
    res.status(500).json({
      error: "Erreur serveur",
      details: e.message,
    });
  }
};