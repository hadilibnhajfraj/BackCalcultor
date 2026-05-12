// compute/frp.js
// VERSION EUROCODE PRF CORRIGÉE

/** =========================================================
 * UTILITAIRES
 * ======================================================= */

const Nmm_to_kNm = (x) => x / 1e6;

const areaFromBars = (diam_mm, nBars) =>
  (Math.PI * diam_mm ** 2) / 4 * nBars;

const areaPerMeter = (diam_mm, spacing_mm) =>
  (1000 / spacing_mm) *
  ((Math.PI * diam_mm ** 2) / 4);

/** =========================================================
 * FLEXION ELU
 * ======================================================= */

function computeFlexure({
  loads,
  geometry,
  concrete,
  frp_long,
}) {

  /** =============================
   * ÉTAPE 0 : DONNÉES
   * =========================== */

  const { Mu_kNm } = loads;

  const {
    b_mm,
    h_mm,
    d_mm,
  } = geometry;

  /** Béton */
  const fck = concrete.fck_MPa;
  const Ec = concrete.Ec_MPa;

  const gamma_c = concrete.gamma_c ?? 1.5;

  const eps_cu =
    concrete.eps_cu ?? 0.0035;

  /** PRF */
  const fPRFk = frp_long.fPRFk_MPa;

  const EPRF =
    frp_long.EPRF_MPa;

  const gamma_frp =
    frp_long.gamma_frp ?? 1.15;

  const alpha_PRF =
    frp_long.alpha_frp ?? 0.85;

  const eps_u =
    frp_long.eps_u ??
    fPRFk / EPRF;

  const APRF =
    frp_long.Af_mm2;

  /** =============================
   * ÉTAPE 1 : PROPRIÉTÉS
   * =========================== */

  /** Résistance PRF */
  const fPRFd =
    (alpha_PRF * fPRFk) /
    gamma_frp;

  /** Résistance béton */
  const fcd =
    fck / gamma_c;

  /** =============================
   * ÉTAPE 2 : TAUX D'ARMATURE
   * =========================== */

  /** Taux réel */
  const rhoPRF =
    APRF / (b_mm * d_mm);

  /** Taux équilibré */
  const rhoPRF_b =
    (0.85 * fcd / fPRFd) *
    (eps_cu / (eps_cu + eps_u));

  /** Détermination du mode */
  let mode = "";

  if (rhoPRF < rhoPRF_b) {
    mode = "traction";
  } else if (rhoPRF > rhoPRF_b) {
    mode = "compression";
  } else {
    mode = "equilibre";
  }

  /** =============================
   * ÉTAPE 3 : VÉRIFICATION ELU
   * =========================== */

  let x_mm = 0;
  let z_mm = 0;

  let epsPRF = 0;
  let sigmaPRF = 0;

  let MRd_kNm = 0;

  /** -----------------------------
   * CAS TRACTION
   * --------------------------- */

  if (mode === "traction") {

    /** εPRF = εu */
    epsPRF = eps_u;

    /** x */
    x_mm =
      (APRF * fPRFd) /
      (0.85 * fcd * b_mm);

    /** bras de levier */
    z_mm =
      d_mm - 0.4 * x_mm;

    /** σPRF */
    sigmaPRF = fPRFd;

    /** Moment résistant */
    MRd_kNm =
      Nmm_to_kNm(
        APRF *
        fPRFd *
        z_mm
      );

  }

  /** -----------------------------
   * CAS COMPRESSION
   * --------------------------- */

  else {

    /** x */
    x_mm =
      (APRF * fPRFd) /
      (0.85 * fcd * b_mm);

    /** εPRF */
    epsPRF =
      eps_cu *
      ((d_mm - x_mm) / x_mm);

    /** σPRF */
    sigmaPRF =
      EPRF * epsPRF;

    /** bras de levier */
    z_mm =
      d_mm - 0.4 * x_mm;

    /** Moment résistant */
    MRd_kNm =
      Nmm_to_kNm(
        APRF *
        sigmaPRF *
        z_mm
      );
  }

  /** =============================
   * ARMATURE MINIMALE
   * =========================== */

  const fctm =
    concrete.fctm_MPa ?? 2.9;

  const k =
    concrete.k ?? 0.8;

  const Amin_mm2 =
    k *
    (fctm / fPRFd) *
    b_mm *
    d_mm;

  /** =============================
   * CONDITION ELU
   * =========================== */

  const ELU_OK =
    Mu_kNm <= MRd_kNm;

  return {

    /** matériaux */
    fcd,
    fPRFd,

    /** taux */
    rhoPRF,
    rhoPRF_b,

    /** mode */
    mode,

    /** déformations */
    epsPRF,

    /** contraintes */
    sigmaPRF,

    /** géométrie */
    x_mm,
    z_mm,

    /** résistance */
    MRd_kNm,

    /** armature mini */
    Amin_mm2,

    /** demande */
    Mu_kNm,

    /** vérification */
    ok: ELU_OK,
  };
}

/** =========================================================
 * ELS
 * ======================================================= */

function computeService({
  loads,
  geometry,
  concrete,
  frp_long,
  service,
}) {

  const {
    Mser_kNm,
    q_kN_m,
    L_m,
  } = loads;

  const {
    b_mm,
    d_mm,
  } = geometry;

  const Ec =
    concrete.Ec_MPa;

  const APRF =
    frp_long.Af_mm2;

  const fPRFk =
    frp_long.fPRFk_MPa;

  /** Bras de levier */
  const z_mm =
    0.9 * d_mm;

  /** =============================
   * CONTRAINTE PRF
   * =========================== */

  const sigmaPRF_ser =
    (Mser_kNm * 1e6) /
    (APRF * z_mm);

  /** =============================
   * FISSURATION
   * wk = srm × (εPRF - εcm)
   * =========================== */

  const srm_mm =
  Number(service.srm_mm ?? 200);

  const epsPRF =
    sigmaPRF_ser /
    frp_long.EPRF_MPa;

 const eps_cm =
  Number(service.eps_cm ?? 0.0001);

  const wk_mm =
    srm_mm *
    (epsPRF - eps_cm);

  /** =============================
   * FLÈCHE
   * =========================== */

  const Ie =
    (b_mm * d_mm ** 3) / 12;

  const L_mm =
    L_m * 1000;

  const fleche_mm =
    (
      5 *
      q_kN_m *
      L_mm ** 4
    ) /
    (
      384 *
      Ec *
      Ie *
      1000
    );

  /** =============================
   * CONDITIONS
   * =========================== */

  const k =
    service.k ?? 0.6;

  const sigma_lim =
    k * fPRFk;

  const wk_lim =
    service.w_lim_mm ?? 0.5;

  const fleche_lim =
    L_mm / 250;

  const sigma_ok =
    sigmaPRF_ser <= sigma_lim;

  const fissure_ok =
    wk_mm <= wk_lim;

  const fleche_ok =
    fleche_mm <= fleche_lim;

  return {

    sigmaPRF_ser,
    sigma_lim,

    wk_mm,
    wk_lim,

    fleche_mm,
    fleche_lim,

    sigma_ok,
    fissure_ok,
    fleche_ok,
  };
}

/** =========================================================
 * WRAPPER
 * ======================================================= */

function computeAll(input) {

  const loads =
    input.loads ?? {};

  const geometry =
    input.geometry ?? {};

  const concrete =
    input.concrete ?? {};

  const service =
    input.service ?? {};

  /** Armature PRF */

  let Af_mm2 =
    input.frp_long?.Af_mm2;

  if (!Af_mm2) {

    const diam =
      input.frp_long?.bar_diam_mm ?? 10;

    const spacing =
      input.frp_long?.spacing_mm ?? 200;

    Af_mm2 =
      areaPerMeter(
        diam,
        spacing
      );
  }

  const frp_long = {

    Af_mm2,

    fPRFk_MPa:
      input.frp_long?.fPRFk_MPa ?? 1000,

    EPRF_MPa:
      input.frp_long?.EPRF_MPa ?? 50000,

    gamma_frp:
      input.frp_long?.gamma_frp ?? 1.15,

    alpha_frp:
      input.frp_long?.alpha_frp ?? 0.85,
  };

  /** ELU */
  const flexure =
    computeFlexure({
      loads,
      geometry,
      concrete,
      frp_long,
    });

  /** ELS */
  const serviceCheck =
    computeService({
      loads,
      geometry,
      concrete,
      frp_long,
      service,
    });

  return {

    inputs: {
      loads,
      geometry,
      concrete,
      frp_long,
    },

    flexure,

    service:
      serviceCheck,

    summary: {

      ELU:
        flexure.ok,

      ELS_contrainte:
        serviceCheck.sigma_ok,

      ELS_fissuration:
        serviceCheck.fissure_ok,

      ELS_fleche:
        serviceCheck.fleche_ok,
    },
  };
}

module.exports = {
  computeAll,
};