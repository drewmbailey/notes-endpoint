import dotenv from "dotenv";

dotenv.config();

// ==== Environment Variable Validation ====
const requiredEnvVars = [
  "API_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
  "NOTES_FOLDER_ID",
  "GITHUB_TOKEN",
  "GITHUB_REPO_OWNER",
  "GITHUB_REPO_NAME",
];

for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    console.error(`❌ Missing required environment variable: ${varName}`);
    process.exit(1);
  }
}

// Export validated configuration
export const config = {
  apiKey: process.env.API_KEY,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  },
  notesFolderId: process.env.NOTES_FOLDER_ID,
  github: {
    token: process.env.GITHUB_TOKEN,
    repoOwner: process.env.GITHUB_REPO_OWNER,
    repoName: process.env.GITHUB_REPO_NAME,
  },
  port: process.env.PORT || 8080,
};

