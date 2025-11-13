import express from "express";
import bodyParser from "body-parser";
import cron from "node-cron";
import { config } from "./config/env.js";
import { backupNotesToGitHub } from "./services/githubBackup.js";
import healthRoutes from "./routes/health.js";
import notesRoutes from "./routes/notes.js";

// ==== Express App Setup ====
const app = express();

// Trust Railway's proxy for rate limiting and IP detection
app.set('trust proxy', true);

app.use(bodyParser.json({ limit: "2mb" }));

// ==== Routes ====
app.use(healthRoutes);
app.use(notesRoutes);

// ==== Cron Job ====
cron.schedule(
  "0 3 * * *",
  async () => {
    console.log("Running scheduled GitHub backup (3 AM ET)...");
    await backupNotesToGitHub();
  },
  { timezone: "America/New_York" }
);

// ==== Graceful Shutdown ====
let isShuttingDown = false;
let server;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\nReceived ${signal}, starting graceful shutdown...`);

  // Stop accepting new requests
  server.close(() => {
    console.log("HTTP server closed");
  });

  // Give ongoing requests 10 seconds to finish
  setTimeout(() => {
    console.log("Forcing shutdown after timeout");
    process.exit(0);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ==== Start Server ====
server = app.listen(config.port, () => {
  console.log(`Notes API running on port ${config.port}`);
  console.log(`Health check available at http://localhost:${config.port}/health`);
  console.log(`API endpoint: POST /api/save-note (requires x-api-key header)`);
  console.log(`Daily backup scheduled for 3:00 AM ET`);
});
