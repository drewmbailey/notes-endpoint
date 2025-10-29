import fs from "fs";

// ==== Cleanup Utilities ====

export async function cleanupTempDirectory(tmpDir) {
  try {
    if (fs.existsSync(tmpDir)) {
      // Check if directory is older than 7 days
      const stats = fs.statSync(tmpDir);
      const daysSinceModified = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
      
      if (daysSinceModified > 7) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        console.log("🧹 Cleaned up old temporary directory");
      }
    }
  } catch (err) {
    console.error("Error cleaning temp directory:", err.message);
  }
}

