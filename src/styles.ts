import { type CSSProperties } from "react";

export type BibTexSlot =
  | "entry" //for styling the whole span of the component
  | "marker" //for styling the marker
  | "address"
  | "annote"
  | "author"
  | "booktitle"
  | "chapter"
  | "doi"
  | "edition"
  | "editor"
  | "howpublished"
  | "institution"
  | "journal"
  | "month"
  | "note"
  | "number"
  | "organization"
  | "pages"
  | "publisher"
  | "school"
  | "series"
  | "title"
  | "type"
  | "volume"
  | "year";

export type BibTexPublication =
  | "article"
  | "book"
  | "booklet"
  | "conference"
  | "inbook"
  | "incollection"
  | "inproceedings"
  | "manual"
  | "mastersthesis"
  | "misc"
  | "phdthesis"
  | "proceedings"
  | "techreport"
  | "unpublished";

export type CitationStyle = "default" | "APA" | "MLA" | "Harvard" | "Chicago";

export const MARKER = { verticalAlign: "super", fontSize: "smaller" };
export const ITALIC = { fontStyle: "italic" };
export const DOI = { color: "#1a73e8", textDecoration: "none" };

export type BibTexStyles = Partial<Record<BibTexSlot, CSSProperties>>;

export type StyleMode = "merge" | "replace";

export const styleFor = (
  defaultStyle: CSSProperties,
  styles?: CSSProperties,
  mode: StyleMode = "merge",
): CSSProperties => {
  const override = styles;
  if (!override) return defaultStyle;
  return mode === "replace" ? override : { ...defaultStyle, ...override };
};
