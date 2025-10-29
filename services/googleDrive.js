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
 * Find or create a category folder in Google Drive
 * @param {string} category - Category name
 * @returns {Promise<string>} - Folder ID
 */
export async function getOrCreateCategoryFolder(category) {
  const sanitizedCategory = sanitizeForDriveQuery(category);
  const sanitizedNotesFolder = sanitizeForDriveQuery(config.notesFolderId);

  // Find existing folder
  const folderQuery = `name='${sanitizedCategory}' and '${sanitizedNotesFolder}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const folderRes = await drive.files.list({ q: folderQuery, fields: "files(id, name)" });
  
  if (folderRes.data.files.length > 0) {
    return folderRes.data.files[0].id;
  }

  // Create new folder
  const folder = await drive.files.create({
    requestBody: {
      name: category,
      mimeType: "application/vnd.google-apps.folder",
      parents: [config.notesFolderId],
    },
    fields: "id",
  });
  
  console.log(`📁 Created new category folder: ${category}`);
  return folder.data.id;
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

