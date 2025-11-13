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
  getDriveTree,
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
 * @param {Array} categories - Array of category objects with name, lastUpdated, path
 * @param {string} backupTimestamp - Backup timestamp string
 */
function generateRootIndex(tmpDir, categories, backupTimestamp) {
  const rootIndexPath = path.join(tmpDir, "index.md");
  const rootLines = ["# Notes Index", ""];
  
  for (const cat of categories.sort((a, b) => a.name.localeCompare(b.name))) {
    const indexPath = cat.path ? `./${cat.path}/index.md` : './index.md';
    rootLines.push(
      `- [${cat.name}](${indexPath}) — last updated ${cat.lastUpdated}`
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
 * Backup all notes from Google Drive to GitHub using recursive tree traversal
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

    // Get entire Drive tree recursively
    console.log("Fetching Drive tree recursively...");
    const tree = await getDriveTree();
    
    // Organize notes by folder path
    const folderMap = new Map(); // path -> { notes: [], lastModified: timestamp }
    
    for (const item of tree) {
      if (item.type === "note") {
        const folderPath = item.path || ""; // Root-level notes have empty path
        
        if (!folderMap.has(folderPath)) {
          folderMap.set(folderPath, { notes: [], lastModified: 0 });
        }
        
        const folderData = folderMap.get(folderPath);
        folderData.notes.push(item);
        
        const modifiedTime = new Date(item.modifiedTime).getTime();
        if (modifiedTime > folderData.lastModified) {
          folderData.lastModified = modifiedTime;
        }
      }
    }
    
    // Process each folder and its notes
    const categories = [];
    
    for (const [folderPath, folderData] of folderMap.entries()) {
      console.log(`Processing folder: ${folderPath || "(root)"}`);
      
      // Create folder structure on disk
      const diskPath = folderPath ? path.join(tmpDir, folderPath) : tmpDir;
      if (!fs.existsSync(diskPath)) {
        fs.mkdirSync(diskPath, { recursive: true });
      }
      
      const entries = [];
      
      // Process each note in this folder
      for (const note of folderData.notes) {
        try {
          // Download file content
          const content = await downloadFileContent(note.id);
          
          const createdISO = new Date(note.createdTime).toISOString();
          const updatedISO = new Date(note.modifiedTime).toISOString();
          
          // Add or update YAML front-matter
          const contentWithFrontMatter = addOrUpdateFrontMatter(content, createdISO, updatedISO);
          
          fs.writeFileSync(path.join(diskPath, note.name), contentWithFrontMatter + "\n", "utf8");
          
          const modified = new Date(note.modifiedTime);
          entries.push({
            name: note.name,
            date: modified.toISOString().split("T")[0],
          });
        } catch (fileErr) {
          console.error(`Error processing file ${note.name}:`, fileErr.message);
          // Continue with other files
        }
      }
      
      // Generate index for this folder
      if (entries.length > 0) {
        const folderName = folderPath ? folderPath.split("/").pop() : "Notes";
        const lastUpdated = folderData.lastModified 
          ? new Date(folderData.lastModified).toISOString().split("T")[0] 
          : "—";
        
        generateCategoryIndex(diskPath, folderName, entries, folderData.lastModified, backupTimestamp);
        
        // Track category for root index
        categories.push({ 
          name: folderPath || "(root)", 
          lastUpdated,
          displayName: folderPath || "Root Notes"
        });
      }
    }
    
    // Generate root index with all top-level categories
    const topLevelCategories = categories
      .filter(cat => !cat.name.includes("/") || cat.name === "(root)")
      .map(cat => ({
        name: cat.displayName,
        lastUpdated: cat.lastUpdated,
        path: cat.name === "(root)" ? "" : cat.name
      }));
    
    generateRootIndex(tmpDir, topLevelCategories, backupTimestamp);

    // Commit and push changes
    await commitAndPush(git);
  } catch (err) {
    console.error("Error during GitHub backup:", err);
    console.error(err.stack);
    // Don't throw - allow the app to continue running
  }
}

