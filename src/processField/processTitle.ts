export function toSentenceCase(input: string): string {
  if (!input) return input;
  return input.toLowerCase().replace(/(^\s*\w|[.!?:;]\s+\w)/g, (match) => match.toUpperCase());
}
