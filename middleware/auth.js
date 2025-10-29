import { config } from "../config/env.js";

// ==== Authentication Middleware ====

export const authMiddleware = (req, res, next) => {
  if (req.headers["x-api-key"] !== config.apiKey) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  next();
};

