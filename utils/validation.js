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
  // Treat category as a slash-separated path of safe segments
  // Examples: "Personal", "Commonplace Books/Coding/General/Design Patterns"
  
  // Overall length check
  if (!category || category.length === 0) {
    return { valid: false, error: "Category cannot be empty" };
  }
  if (category.length > 200) {
    return { valid: false, error: "Category path too long (max 200 characters)" };
  }

  // Check for invalid characters (control chars and Drive-unfriendly chars)
  const invalidChars = /[<>:"|?*\x00-\x1F]/;
  if (invalidChars.test(category)) {
    return { valid: false, error: "Category contains invalid characters" };
  }

  // Forbid leading/trailing slashes or double slashes
  if (category.startsWith("/") || category.endsWith("/")) {
    return { valid: false, error: "Category path cannot start or end with /" };
  }
  if (category.includes("//")) {
    return { valid: false, error: "Category path cannot contain empty segments (//)" };
  }

  // Split by / and validate each segment
  const segments = category.split("/").map(s => s.trim());
  
  for (const segment of segments) {
    // Must be non-empty after trimming
    if (segment.length === 0) {
      return { valid: false, error: "Category path cannot contain empty segments" };
    }
    
    // Forbid . and .. (path traversal prevention)
    if (segment === "." || segment === "..") {
      return { valid: false, error: "Category segments cannot be . or .." };
    }
    
    // Each segment must match allowed characters: alphanumeric, spaces, hyphens, underscores
    const validPattern = /^[a-zA-Z0-9\s\-_]+$/;
    if (!validPattern.test(segment)) {
      return { valid: false, error: `Category segment "${segment}" contains invalid characters` };
    }
    
    // Segment length check
    if (segment.length > 100) {
      return { valid: false, error: `Category segment "${segment}" too long (max 100 characters)` };
    }
  }

  // Optional: max depth check (prevents deeply pathological paths)
  if (segments.length > 10) {
    return { valid: false, error: "Category path too deep (max 10 levels)" };
  }

  return { valid: true };
}

