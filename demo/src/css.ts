import type { CSSProperties } from "react";

const toCamelCase = (property: string) =>
  property.toLowerCase().replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

/**
 * Reads a run of CSS declarations — `color: #b00; font-weight: 600` — into the
 * object form React wants. Incomplete declarations are ignored rather than
 * thrown, so the result panel keeps up while you are still typing.
 */
export function parseDeclarations(input: string): CSSProperties {
  const style: Record<string, string> = {};

  for (const declaration of input.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon === -1) continue;

    const property = declaration.slice(0, colon).trim();
    const value = declaration.slice(colon + 1).trim();
    if (!property || !value) continue;

    // Custom properties keep their exact spelling; everything else is camelCased.
    style[property.startsWith("--") ? property : toCamelCase(property)] = value;
  }

  return style as CSSProperties;
}
