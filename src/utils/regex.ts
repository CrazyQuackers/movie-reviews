/** Escapes regex metacharacters so user input is matched literally (and can't cause ReDoS or errors). */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
