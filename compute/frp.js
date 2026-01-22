// compute/frp.js (CommonJS)

/** Utils */
const Nmm_to_kNm = (x) => x / 1e6;
const areaFromBars = (diam_mm, nBars) =>
  (Math.PI * (diam_mm ** 2) / 4) * nBars;
const areaPerMeter = (diam_mm, s_mm) =>
  (1000 / s_mm) * (Math.PI * (diam_mm ** 2) / 4);

function alpha1_from_fc(fc) {
  return Math.max(0.67, 0.85 - 0.0015 * fc);
}
function beta1_from_fc(fc) {
  return Math.max(0.67, 0.97 - 0.0025 * fc);
}

/**
 * rho_min estimation (simple)
 */
function rho_min_from_fc_fcuf(fc, ffu) {
  if (!fc || !ffu) return null;
  return (1.4 * Math.sqrt(fc)) / ffu;
}

/** ---------- FLEXION (ELU) ---------- */
function computeFlexure({ loads: { Mu_kNm }, geometry: { b_mm, d_mm }, concrete, frp_long }) {
  const fc = concrete.fc_MPa;
  const eps_cu = concrete.eps_cu ?? 0.0035;

  const alpha1 = concrete.alpha1 ?? alpha1_from_fc(fc);
  const beta1 = concrete.beta1 ?? beta1_from_fc(fc);
  const phiC = concrete.phi_c ?? 0.65;

  const Af = frp_long.Af_mm2;
  const Ef = frp_long.Ef_MPa;
  const ffu = frp_long.ffu_MPa;
  const phiF = frp_long.phi_f ?? 0.9;

  // ratios
  const rho_frp = (b_mm && d_mm) ? Af / (b_mm * d_mm) : null;
  const eps_fpu = ffu && Ef ? ffu / Ef : null;

  let rho_frpb = null;
  if (eps_fpu && fc && phiF && phiC) {
    rho_frpb =
      alpha1 *
      beta1 *
      (phiC / phiF) *
      (fc / ffu) *
      (eps_cu / (eps_cu + eps_fpu));
  }

  const rho_min = rho_min_from_fc_fcuf(fc, ffu);

  // equilibrium iterative T = C
  let c_lo = 1e-6;
  let c_hi = Math.max(0.99 * d_mm, 1);
  let c = 0.5 * (c_lo + c_hi);
  let T = 0, C = 1, eps_frp = 0, f_frp_raw = 0, f_frp = 0;

  for (let it = 0; it < 80; it++) {
    eps_frp = (eps_cu * (d_mm - c)) / c;
    f_frp_raw = Ef * eps_frp;
    f_frp = Math.min(f_frp_raw, ffu || f_frp_raw);

    T = Af * phiF * f_frp; // N
    C = alpha1 * fc * b_mm * (beta1 * c); // N

    if (Math.abs(T - C) / Math.max(1, C) < 1e-6) break;
    if (T > C) c_lo = c; else c_hi = c;
    c = 0.5 * (c_lo + c_hi);
  }

  const z = d_mm - (beta1 * c) / 2;
  const Mn_kNm = Nmm_to_kNm(T * z);
  const phiMn_kNm = phiF * Mn_kNm;

  const eps_fu = ffu && Ef ? ffu / Ef : null;
  const frpRuptureControls = ffu ? f_frp_raw >= ffu - 1e-9 : false;

  let failureMode = "Section contrôlée par compression (béton)";
  let rhoCompareSymbol = "—";
  if (rho_frp != null && rho_frpb != null) {
    if (rho_frp < rho_frpb) {
      rhoCompareSymbol = "<";
      failureMode = "Tension failure (rupture des barres GFRP)";
    } else if (rho_frp > rho_frpb) {
      rhoCompareSymbol = ">";
      failureMode = "Compression failure (écrasement du béton)";
    } else {
      rhoCompareSymbol = "≈";
      failureMode = "Section équilibrée";
    }
  } else if (frpRuptureControls) {
    failureMode = "Section en traction (Rupture FRP)";
  }

  const equilibrium_ok = Math.abs(T - C) / Math.max(1, C) < 1e-3;

  return {
    c_mm: c,
    z_mm: z,
    T_N: T,
    C_N: C,
    eps_frp,
    eps_fu,
    f_frp,
    f_frp_raw,
    ffu,
    Mn_kNm,
    phiMn_kNm,
    equilibrium_ok,

    rho_frp,
    rho_frpb,
    rho_min,
    rhoCompareSymbol,
    failureMode,

    frpRuptureControls,
    ok: phiMn_kNm >= Mu_kNm,
  };
}

/** ---------- FISSURATION ---------- */
function computeCracking({ geometry: { b_mm, h_mm }, concrete: { fc_MPa } }) {
  const fr = 0.6 * Math.sqrt(fc_MPa);
  const I = (b_mm * h_mm ** 3) / 12;
  const y = h_mm / 2;
  const Mcr_kNm = Nmm_to_kNm((fr * I) / y);
  return { fr_MPa: fr, I_mm4: I, y_mm: y, Mcr_kNm };
}

/** ---------- Largeur de fissure ---------- */
function computeCrackWidth({ geometry: { h_mm, d_mm }, frp_long, service }) {
  const kb = service.kb ?? 1.2;
  const h2_over_h = service.h2_over_h ?? 0.9;
  const w_lim_mm = service.w_lim_mm ?? 0.3;

  const fm = 0.35 * frp_long.ffu_MPa;
  const w =
    2.2 *
    kb *
    (fm / frp_long.Ef_MPa) *
    h2_over_h *
    Math.sqrt(d_mm * frp_long.Af_mm2);

  return { fm_MPa: fm, w_mm: w, w_lim_mm, ok: w <= w_lim_mm };
}

/** ---------- Cisaillement ---------- */
function computeShear({
  loads: { Vu_kN }, geometry: { b_mm, d_mm }, concrete: { fc_MPa }, frp_shear,
}) {
  const Vc_N = 0.17 * Math.sqrt(fc_MPa) * b_mm * d_mm;
  let Vfrp_N = 0;

  if (frp_shear?.hasStirrups) {
    const Afv = frp_shear.Afv_mm2 ?? 0;
    const s = frp_shear.s_mm ?? 100;
    const phi = frp_shear.phi_v ?? 0.75;
    const ffv = frp_shear.ffv_MPa ?? 265;
    const theta = ((frp_shear.theta_deg ?? 90) * Math.PI) / 180;
    const cot = 1 / Math.tan(theta);
    Vfrp_N = (Afv * phi * ffv * d_mm * cot) / s;
  }

  const Vn_kN = (Vc_N + Vfrp_N) / 1000;
  return {
    Vc_kN: Vc_N / 1000,
    Vfrp_kN: Vfrp_N / 1000,
    Vn_kN,
    Vu_kN,
    ok: Vn_kN >= Vu_kN,
    note: frp_shear?.hasStirrups ? "Étriers FRP" : "Sans étriers",
  };
}

/** ---------- Wrapper global ---------- */
function computeAll(input) {
  const elementType = input.elementType ?? "dalle";
  const loads = input.loads ?? { Mu_kNm: 0, Vu_kN: 0 };
  const geometry = input.geometry ?? { b_mm: 1000, h_mm: 100, d_mm: 90 };
  const concrete = input.concrete ?? { fc_MPa: 35, eps_cu: 0.0035 };
  const frp_shear = input.frp_shear ?? {};
  const service = input.service ?? {};

  let Af_mm2 = input.frp_long?.Af_mm2;
  if (!Af_mm2) {
    if (elementType === "dalle") {
      const d = input.frp_long?.bar_diam_mm ?? 8;
      const s = input.frp_long?.spacing_mm ?? 200;
      Af_mm2 = areaPerMeter(d, s);
    } else {
      const d = input.frp_long?.bar_diam_mm ?? 12;
      const n = input.frp_long?.nBars ?? 5;
      Af_mm2 = areaFromBars(d, n);
    }
  }

  const frp_long = {
    Af_mm2,
    Ef_MPa: input.frp_long?.Ef_MPa ?? 53000,
    ffu_MPa: input.frp_long?.ffu_MPa ?? 1060,
    phi_f: input.frp_long?.phi_f ?? 0.9,
  };

  const flexure = computeFlexure({ loads, geometry, concrete, frp_long });
  const cracking = computeCracking({ geometry, concrete });
  const crack_width = computeCrackWidth({ geometry, frp_long, service });
  const shear = computeShear({ loads, geometry, concrete, frp_shear });

  return {
    elementType,
    inputs: { loads, geometry, concrete, frp_long, frp_shear, service },
    flexure,
    cracking: { ...cracking, Mu_gt_1p5Mcr: loads.Mu_kNm > 1.5 * cracking.Mcr_kNm },
    crack_width,
    shear,
    summary: {
      flexion_OK: flexure.ok,
      fissuration_OK: loads.Mu_kNm > 1.5 * cracking.Mcr_kNm,
      largeur_fissure_OK: crack_width.ok,
      cisaillement_OK: shear.ok,
    },
  };
}

module.exports = { computeAll };
