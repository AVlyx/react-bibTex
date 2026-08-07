import { CSSProperties } from "react";

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
  marker: {},
  author: {},
  title: { fontStyle: "italic" },
  journal: { fontWeight: 700 },
  volume: {},
  year: {},
  doi: { color: "#1a73e8", textDecoration: "none" },
};

export type BibTexStyles = Partial<Record<BibTexSlot, CSSProperties>>;

export const styleFor = (slot: BibTexSlot, styles?: BibTexStyles): CSSProperties => ({
  ...defaultStyles[slot],
  ...styles?.[slot],
});
