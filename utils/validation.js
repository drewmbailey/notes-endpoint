// ==== Validation Utilities ====

export function sanitizeForDriveQuery(input) {
  // Escape single quotes and backslashes for Google Drive API queries
  return input.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function validateFilename(filename) {
  // Prevent path traversal and ensure valid markdown filename
  const invalidChars = /[<>:"|?*\x00-\x1F]/;
  if (invalidChars.test(filename)) {
    return { valid: false, error: "Filename contains invalid characters" };
  }
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return { valid: false, error: "Filename cannot contain path separators" };
  }
  if (!filename.endsWith(".md")) {
    return { valid: false, error: "Filename must end with .md" };
  }
  if (filename.length > 255) {
    return { valid: false, error: "Filename too long" };
  }
  return { valid: true };
}

export function validateCategory(category) {
  // Allow alphanumeric, spaces, hyphens, and underscores
  const validPattern = /^[a-zA-Z0-9\s\-_]+$/;
  if (!validPattern.test(category)) {
    return { valid: false, error: "Category contains invalid characters" };
  }
  if (category.length > 100) {
    return { valid: false, error: "Category name too long" };
  }
  return { valid: true };
}

