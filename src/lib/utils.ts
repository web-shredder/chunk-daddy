import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Strips leading Markdown heading cascade from chunk text.
 * Chunks often include cascaded headings like "# H1\n\n## H2\n\nBody content..."
 * This extracts just the body content for display in chunk cards.
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
