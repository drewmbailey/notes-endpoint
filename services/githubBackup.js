import fs from "fs";
import path from "path";
import os from "os";
import simpleGit from "simple-git";
import { config } from "../config/env.js";
import { cleanupTempDirectory } from "../utils/cleanup.js";
import {
  getAllCategoryFolders,
  getNotesInFolder,
  downloadFileContent,
} from "./googleDrive.js";

// ==== GitHub Backup Service ====

/**
 * Add or update YAML front-matter in markdown content
 * @param {string} content - Original markdown content
 * @param {string} createdISO - Created timestamp in ISO format
 * @param {string} updatedISO - Updated timestamp in ISO format
 * @returns {string} - Content with front-matter
 */
function addOrUpdateFrontMatter(content, createdISO, updatedISO) {
  content = content.trim();

  if (!/^---\n/.test(content)) {
    // Add new front-matter
    return `---\ncreated: ${createdISO}\nlast_updated: ${updatedISO}\n---\n\n${content}`;
  }

  // Update existing front-matter
  const frontMatterEnd = content.indexOf("---", 4);
  if (frontMatterEnd === -1) {
    return content; // Invalid front-matter, return as-is
  }

  let frontMatter = content.substring(4, frontMatterEnd);

  if (/created:\s*.*/i.test(frontMatter)) {
    frontMatter = frontMatter.replace(/created:\s*.*/i, `created: ${createdISO}`);
  } else {
    frontMatter = `created: ${createdISO}\n${frontMatter}`;
  }

  if (/last_updated:\s*.*/i.test(frontMatter)) {
    frontMatter = frontMatter.replace(/last_updated:\s*.*/i, `last_updated: ${updatedISO}`);
  } else {
    frontMatter = `${frontMatter}\nlast_updated: ${updatedISO}`;
  }

  return `---\n${frontMatter}\n---${content.substring(frontMatterEnd + 3)}`;
}

/**
 * Generate category index file
 * @param {string} folderPath - Path to category folder
 * @param {string} categoryName - Category name
 * @param {Array} entries - Array of note entries
 * @param {number} newestTimestamp - Newest modified timestamp
 * @param {string} backupTimestamp - Backup timestamp string
 */
function generateCategoryIndex(folderPath, categoryName, entries, newestTimestamp, backupTimestamp) {
  const lastUpdated = newestTimestamp ? new Date(newestTimestamp).toISOString().split("T")[0] : "—";
  const indexPath = path.join(folderPath, "index.md");
  
  const lines = [
    `# Index – ${categoryName} Notes`,
    ``,
    `_Last updated: ${lastUpdated}_`,
    ``,
  ];

  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    lines.push(`- [${e.name.replace(".md", "")}](./${e.name}) — ${e.date}`);
  }

  lines.push(`\n---\n_Backup generated automatically at ${backupTimestamp} ET_`);
  fs.writeFileSync(indexPath, lines.join("\n") + "\n", "utf8");
}

/**
 * Generate root index file
 * @param {string} tmpDir - Temporary directory path
 * @param {Array} categories - Array of category objects
 * @param {string} backupTimestamp - Backup timestamp string
 */
function generateRootIndex(tmpDir, categories, backupTimestamp) {
  const rootIndexPath = path.join(tmpDir, "index.md");
  const rootLines = ["# Notes Index", ""];
  
  for (const cat of categories.sort((a, b) => a.name.localeCompare(b.name))) {
    rootLines.push(
      `- [${cat.name}](./${cat.name}/index.md) — last updated ${cat.lastUpdated}`
    );
  }
  
  rootLines.push(`\n---\n_Backup generated automatically at ${backupTimestamp} ET_`);
  fs.writeFileSync(rootIndexPath, rootLines.join("\n") + "\n", "utf8");
}

/**
 * Initialize git repository (clone or pull)
 * @param {object} git - SimpleGit instance
 * @param {string} tmpDir - Temporary directory path
 */
async function initializeRepository(git, tmpDir) {
  if (!fs.existsSync(tmpDir)) {
    console.log("Cloning repository...");
    await git.clone(
      `https://github.com/${config.github.repoOwner}/${config.github.repoName}.git`,
      tmpDir
    );

    // Configure git to use token for authentication
    await git.cwd(tmpDir);
    await git.addConfig("user.name", "Notes Backup Bot");
    await git.addConfig("user.email", "notes-backup@automated.local");
    await git.addRemote(
      "auth-origin",
      `https://${config.github.token}@github.com/${config.github.repoOwner}/${config.github.repoName}.git`
    ).catch(() => {}); // Ignore if already exists
  } else {
    await git.cwd(tmpDir);
    console.log("Pulling latest changes...");
    try {
      await git.pull();
    } catch (pullErr) {
      console.warn("Pull failed, attempting to reset and pull again...");
      await git.reset(["--hard"]);
      await git.pull();
    }
  }
}

/**
 * Process a single category folder
 * @param {object} folder - Folder object with id and name
 * @param {string} tmpDir - Temporary directory path
 * @returns {Promise<object>} - Category info with name and lastUpdated
 */
async function processCategory(folder, tmpDir) {
  console.log(`Processing category: ${folder.name}`);
  const folderPath = path.join(tmpDir, folder.name);
  
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  const notes = await getNotesInFolder(folder.id);
  const entries = [];
  let newest = 0;

  for (const file of notes) {
    try {
      // Download file content
      const content = await downloadFileContent(file.id);

      const createdISO = new Date(file.createdTime).toISOString();
      const updatedISO = new Date(file.modifiedTime).toISOString();

      // Add or update YAML front-matter
      const contentWithFrontMatter = addOrUpdateFrontMatter(content, createdISO, updatedISO);

      fs.writeFileSync(path.join(folderPath, file.name), contentWithFrontMatter + "\n", "utf8");

      const modified = new Date(file.modifiedTime);
      entries.push({
        name: file.name,
        date: modified.toISOString().split("T")[0],
      });

      if (modified.getTime() > newest) {
        newest = modified.getTime();
      }
    } catch (fileErr) {
      console.error(`Error processing file ${file.name}:`, fileErr.message);
      // Continue with other files
    }
  }

  return { folder, entries, newest };
}

/**
 * Commit and push changes to GitHub
 * @param {object} git - SimpleGit instance
 */
async function commitAndPush(git) {
  await git.add(".");
  const status = await git.status();

  if (status.modified.length || status.not_added.length || status.created.length) {
    await git.commit(`Automated backup: ${new Date().toISOString()}`);

    // Detect default branch
    const branches = await git.branch();
    const defaultBranch = branches.current || "main";

    // Push using the authenticated remote if it exists, otherwise use origin
    try {
      await git.push("auth-origin", defaultBranch);
    } catch {
      await git.push("origin", defaultBranch);
    }

    console.log("Notes and indexes backed up to GitHub.");
  } else {
    console.log("No new changes to back up.");
  }
}

/**
 * Backup all notes from Google Drive to GitHub
 */
export async function backupNotesToGitHub() {
  const tmpDir = path.join(os.tmpdir(), "notes-backup");
  const git = simpleGit();

  try {
    console.log("Starting Google Drive → GitHub backup...");

    // Cleanup old temp directory if needed
    await cleanupTempDirectory(tmpDir);

    // Clone or pull repository
    await initializeRepository(git, tmpDir);

    // Get backup timestamp
    const now = new Date();
    const backupTimestamp = now.toLocaleString("en-US", {
      timeZone: "America/New_York",
      dateStyle: "medium",
      timeStyle: "short",
    });

    // Fetch all category folders
    const folders = await getAllCategoryFolders();
    const categories = [];

    // Process each category
    for (const folder of folders) {
      const { entries, newest } = await processCategory(folder, tmpDir);
      
      // Generate category index
      const lastUpdated = newest ? new Date(newest).toISOString().split("T")[0] : "—";
      generateCategoryIndex(tmpDir + "/" + folder.name, folder.name, entries, newest, backupTimestamp);
      
      categories.push({ name: folder.name, lastUpdated });
    }

    // Generate root index
    generateRootIndex(tmpDir, categories, backupTimestamp);

    // Commit and push changes
    await commitAndPush(git);
  } catch (err) {
    console.error("Error during GitHub backup:", err);
    console.error(err.stack);
    // Don't throw - allow the app to continue running
  }
}

