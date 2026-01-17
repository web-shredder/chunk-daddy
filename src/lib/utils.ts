import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Strips leading Markdown heading cascade from chunk text.
 * Chunks often include cascaded headings like "# H1\n\n## H2\n\nBody content..."
 * This extracts just the body content for display in chunk cards.
 * 
 * IMPORTANT: This is for DISPLAY only. Never mutate chunk.text - it's the source
 * of truth for embeddings and scoring.
 */
export function stripLeadingHeadingCascade(text: string): string {
  if (!text) return '';
  // Match leading heading lines (one or more) followed by content
  const match = text.match(/^((?:#{1,6}\s+[^\n]+\n+)+)/);
  if (match) {
    return text.slice(match[0].length).trim();
  }
  return text.trim();
}

/**
 * Extracts just the cascade heading portion from chunk text (for display as metadata).
 * Returns the heading lines without the body content.
 * 
 * Example: "# H1\n\n## H2\n\nBody content" → "# H1\n\n## H2"
 */
export function extractCascade(text: string): string {
  if (!text) return '';
  const headingPattern = /^((?:#{1,6}\s+[^\n]+\n+)+)/;
  const match = text.match(headingPattern);
  return match ? match[1].trim() : '';
}
