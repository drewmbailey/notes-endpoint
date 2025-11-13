import { backupNotesToGitHub } from "./services/githubBackup.js";

console.log("Manually triggering GitHub backup...\n");

await backupNotesToGitHub();

console.log("\nBackup test complete!");
process.exit(0);

