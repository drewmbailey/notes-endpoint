import express from "express";
import { validateFilename, validateCategory } from "../utils/validation.js";
import { getOrCreateCategoryFolder, saveNoteFile } from "../services/googleDrive.js";
import { authMiddleware } from "../middleware/auth.js";
import { apiLimiter } from "../middleware/rateLimiting.js";

const router = express.Router();

// ==== Save Note Endpoint ====
router.post("/api/save-note", apiLimiter, authMiddleware, async (req, res) => {
  try {
    const { category, filename, content } = req.body;

    // Validate required fields
    if (!category || !filename || !content) {
      return res.status(400).json({ error: "Missing required fields: category, filename, content" });
    }

    // Validate content size
    if (content.length > 1024 * 1024 * 2) {
      return res.status(400).json({ error: "Content exceeds 2MB limit" });
    }

    // Validate filename
    const filenameValidation = validateFilename(filename);
    if (!filenameValidation.valid) {
      return res.status(400).json({ error: filenameValidation.error });
    }

    // Validate category
    const categoryValidation = validateCategory(category);
    if (!categoryValidation.valid) {
      return res.status(400).json({ error: categoryValidation.error });
    }

    // Find or create category folder
    const folderId = await getOrCreateCategoryFolder(category);

    // Save or update note file
    const file = await saveNoteFile(folderId, filename, content);

    res.json({ message: "Note saved successfully", link: file.webViewLink });
  } catch (err) {
    console.error("Error saving note:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;

