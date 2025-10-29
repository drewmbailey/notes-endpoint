import express from "express";

const router = express.Router();

// ==== Health Check Endpoint (no auth required) ====
router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;

