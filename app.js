const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
require("dotenv").config();

const { sequelize } = require("./models"); // ✅ AJOUTE ÇA

const indexRouter = require("./routes/index");
const usersRouter = require("./routes/users");
const authRoutes = require("./routes/auth.routes");
const frpRouter = require("./routes/frp.routes");
const app = express();

/* ====== CORS universel (dev) — placé AVANT tout ====== */
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    req.headers["access-control-request-headers"] || "Authorization,Content-Type"
  );
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
/* ===================================================== */

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

/* ✅✅✅ ICI EXACTEMENT : init DB + création tables */
(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ DB connection OK (from app.js)");

    await sequelize.sync({ alter: true }); // crée frp_calculations si absente
    console.log("✅ DB synced (tables ready)");
  } catch (e) {
    console.error("❌ DB init error:", e);
  }
})();
/* ✅✅✅ FIN BLOC */

/* ✅ Routes après */
app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/auth", authRoutes);
app.use("/frp", frpRouter);

app.use((req, res, next) => next(createError(404)));

app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status);
  if (req.headers.origin) {
    res.set("Access-Control-Allow-Origin", req.headers.origin);
    res.set("Vary", "Origin");
  }
  const wantsJson =
    (req.headers.accept || "").includes("application/json") || req.originalUrl.startsWith("/auth");
  if (wantsJson) res.json({ error: err.message, status });
  else res.render("error", { message: err.message, error: req.app.get("env") === "development" ? err : {} });
});

module.exports = app;
