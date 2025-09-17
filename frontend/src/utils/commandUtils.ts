/**
 * Best-effort utility to append semicolons to each non-empty line in shell commands.
 * Preserves here-doc blocks, comments, and lines already ending with ;, &&, or \
 */
export const appendSemicolons = (text: string): string => {
  if (!text) return text;
  const lines = text.split(/\r?\n/);
  let inHereDoc = false;
  let terminator: string | null = null;
  const processed = lines.map((line) => {
    if (!inHereDoc) {
      const hereDocMatch = line.match(/<<-?\s*([A-Za-z0-9_]+)/);
      if (hereDocMatch) {
        inHereDoc = true;
        terminator = hereDocMatch[1];
        return line;
      }
      const trimmed = line.trim();
      if (trimmed === "" || trimmed.startsWith("#")) return line;
      if (/(&&|;|\\)$/.test(trimmed)) return line;
      return line + " ;";
    } else {
      if (terminator && line.trim() === terminator) {
        inHereDoc = false;
        terminator = null;
      }
      return line;
    }
  });
  return processed.join("\n");
};
