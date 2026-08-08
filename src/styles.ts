import { type CSSProperties } from "react";

export type BibTexSlot =
  | "entry"
  | "marker"
  | "author"
  | "title"
  | "journal"
  | "volume"
  | "year"
  | "doi";

export const defaultStyles: Record<BibTexSlot, CSSProperties> = {
  entry: {},
  marker: { verticalAlign: "super", fontSize: "smaller" },
  author: {},
  title: { fontStyle: "italic" },
  journal: { fontWeight: 700 },
  volume: {},
  year: {},
  doi: { color: "#1a73e8", textDecoration: "none" },
};

export type BibTexStyles = Partial<Record<BibTexSlot, CSSProperties>>;

/**
 * How a slot's override combines with its default. `merge` layers the override
 * on top, so partial overrides keep the rest of the default; `replace` takes the
 * override verbatim, which is the way to drop a default rather than restate it.
 *
 * Either way this is per slot: a slot with no override keeps its default.
 */
export type StyleMode = "merge" | "replace";

export const styleFor = (
  slot: BibTexSlot,
  styles?: BibTexStyles,
  mode: StyleMode = "merge",
): CSSProperties => {
  const override = styles?.[slot];
  if (!override) return defaultStyles[slot];
  return mode === "replace" ? override : { ...defaultStyles[slot], ...override };
};
