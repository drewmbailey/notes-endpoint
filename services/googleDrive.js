import { google } from "googleapis";
import { Readable } from "stream";
import { config } from "../config/env.js";
import { sanitizeForDriveQuery } from "../utils/validation.js";

// ==== Google Drive Service ====

// Initialize OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  config.google.clientId,
  config.google.clientSecret,
  "https://developers.google.com/oauthplayground"
);
oauth2Client.setCredentials({ refresh_token: config.google.refreshToken });

// Initialize Drive API
export const drive = google.drive({ version: "v3", auth: oauth2Client });

/**
 * Find or create a category folder in Google Drive, handling nested paths
 * @param {string} categoryPath - Category path (e.g., "Personal" or "Commonplace Books/Coding/General")
 * @returns {Promise<string>} - Folder ID of the deepest folder
 */
export async function getOrCreateCategoryFolder(categoryPath) {
  // Split the path into segments and clean them
  const segments = categoryPath.split("/").map(s => s.trim()).filter(Boolean);
  
  // Start from the root notes folder
  let parentId = config.notesFolderId;
  
  // Walk down the path, finding or creating each folder
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const sanitizedSegment = sanitizeForDriveQuery(segment);
    const sanitizedParentId = sanitizeForDriveQuery(parentId);
    
    // Search for existing folder with this name under current parent
    const folderQuery = `name='${sanitizedSegment}' and '${sanitizedParentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const folderRes = await drive.files.list({ 
      q: folderQuery, 
      fields: "files(id, name)",
      spaces: "drive"
    });
    
    if (folderRes.data.files.length > 0) {
      // Folder exists, use it
      parentId = folderRes.data.files[0].id;
      console.log(`📂 Found existing folder: ${segment} (${parentId})`);
    } else {
      // Create new folder under current parent
      const folder = await drive.files.create({
        requestBody: {
          name: segment,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentId],
        },
        fields: "id",
      });
      
      parentId = folder.data.id;
      const pathSoFar = segments.slice(0, i + 1).join("/");
      console.log(`📁 Created new folder: ${pathSoFar} (${parentId})`);
    }
  }
  
  // Return the ID of the deepest folder
  return parentId;
}

/**
 * Save or update a note file in Google Drive
 * @param {string} folderId - Parent folder ID
 * @param {string} filename - File name
 * @param {string} content - File content
 * @returns {Promise<object>} - File data with ID and webViewLink
 */
export async function saveNoteFile(folderId, filename, content) {
  const sanitizedFilename = sanitizeForDriveQuery(filename);
  
  // Check if file already exists
  const existingFileQuery = `name='${sanitizedFilename}' and '${folderId}' in parents and trashed=false`;
  const existingFileRes = await drive.files.list({ q: existingFileQuery, fields: "files(id, name)" });

  // Create a readable stream from the content
  const stream = Readable.from([content]);
  const media = { mimeType: "text/markdown", body: stream };

  if (existingFileRes.data.files.length > 0) {
    // Update existing file
    const fileId = existingFileRes.data.files[0].id;
    const file = await drive.files.update({
      fileId,
      media,
      fields: "id, webViewLink",
    });
    console.log(`Updated existing note: ${filename}`);
    return file.data;
  } else {
    // Create new file
    const fileMetadata = { name: filename, parents: [folderId] };
    const file = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: "id, webViewLink",
    });
    console.log(`Created new note: ${filename}`);
    return file.data;
  }
}

/**
 * Fetch all category folders from Google Drive
 * @returns {Promise<Array>} - Array of folder objects with id and name
 */
export async function getAllCategoryFolders() {
  const folderRes = await drive.files.list({
    q: `'${config.notesFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
  });
  return folderRes.data.files;
}

/**
 * Fetch all notes from a folder with metadata
 * @param {string} folderId - Folder ID
 * @returns {Promise<Array>} - Array of file objects
 */
export async function getNotesInFolder(folderId) {
  const notesRes = await drive.files.list({
    q: `'${folderId}' in parents and mimeType='text/markdown' and trashed=false`,
    fields: "files(id, name, createdTime, modifiedTime)",
  });
  return notesRes.data.files;
}

/**
 * Download file content from Google Drive
 * @param {string} fileId - File ID
 * @returns {Promise<string>} - File content
 */
export async function downloadFileContent(fileId) {
  const fileRes = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "text" }
  );
  return fileRes.data;
}

/**
 * Recursively walk the Drive folder tree and collect all folders and notes
 * @param {string} startFolderId - Starting folder ID (defaults to NOTES_FOLDER_ID)
 * @param {string} currentPath - Current path prefix (empty for root)
 * @returns {Promise<Array>} - Flat array of { type, id, name, path, ... } objects
 */
export async function getDriveTree(startFolderId = config.notesFolderId, currentPath = "") {
  const results = [];
  
  // List all child folders
  const foldersRes = await drive.files.list({
    q: `'${startFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
    spaces: "drive"
  });
  
  // Process each folder recursively
  for (const folder of foldersRes.data.files) {
    const folderPath = currentPath ? `${currentPath}/${folder.name}` : folder.name;
    
    // Add folder entry
    results.push({
      type: "folder",
      id: folder.id,
      name: folder.name,
      path: folderPath,
    });
    
    // Recursively get contents of this folder
    const childResults = await getDriveTree(folder.id, folderPath);
    results.push(...childResults);
  }
  
  // List all markdown files in current folder
  const notesRes = await drive.files.list({
    q: `'${startFolderId}' in parents and mimeType='text/markdown' and trashed=false`,
    fields: "files(id, name, createdTime, modifiedTime)",
    spaces: "drive"
  });
  
  // Add note entries
  for (const note of notesRes.data.files) {
    results.push({
      type: "note",
      id: note.id,
      name: note.name,
      path: currentPath, // The folder path this note is in
      createdTime: note.createdTime,
      modifiedTime: note.modifiedTime,
    });
  }
  
  return results;
}

