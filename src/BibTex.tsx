import { Fragment } from "react";
import { parseBibTex } from "./semantic";
import { type BibEntry } from "./parse";
import {
  // type BibTexSlot,
  type BibTexStyles,
  type CitationStyle,
  DOI,
  ITALIC,
  MARKER,
  type StyleMode,
  styleFor,
} from "./styles";

interface BibTexCommon {
  id?: string;
  refs?: {
    /** Citation number for the markers.*/
    n: number | string;
    /**ref link */
    link: string;
  }[];
  citationStyle: CitationStyle;
  /** Use "entry" to style the whole reference and "marker" for the marker */
  styles?: BibTexStyles;
  /** How `styles` combines with the defaults, per slot. Default `"merge"`. */
  styleMode?: StyleMode;
}

export type BibTexProps = BibTexCommon &
  ({ children: string; entry?: never } | { entry: BibEntry; children?: never });

const doiParts = (doi: string) => {
  const bare = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, "");
  return { bare, href: `https://doi.org/${bare}` };
};

export function BibTex({
  children,
  entry: parsed,
  refs,
  id,
  citationStyle = "default",
  styles,
  styleMode = "merge",
}: BibTexProps) {
  let entry: BibEntry;
  try {
    entry = parsed ?? parseBibTex(children ?? "");
  } catch (error) {
    return (
      <span role="alert" style={{ color: "#c32020" }}>
        {error instanceof Error ? error.message : "Could not read this BibTeX source."}
      </span>
    );
  }

  const { type, fields } = entry;
  const doi = fields.doi ? doiParts(fields.doi) : undefined;

  const defaultRef = () => (
    <span id={id} style={styles?.entry} data-type={type}>
      {refs?.map(({ n, link }) => (
        <Fragment key={link}>
          <span style={styleFor(MARKER, styles?.marker, styleMode)}>
            <a href={link}>{n}</a>
          </span>{" "}
        </Fragment>
      ))}
      {fields.author && <span style={styles?.author}>{fields.author}. </span>}
      {fields.title && (
        <>
          <span style={styleFor(ITALIC, styles?.title, styleMode)}>{fields.title}</span>.{" "}
        </>
      )}
      {fields.journal && (
        <>
          <span style={styles?.journal}>{fields.journal}</span>.{" "}
        </>
      )}
      {fields.volume && (
        <span style={styles?.journal}>
          vol. {fields.volume}
          {fields.number && `(${fields.number})`}.{" "}
        </span>
      )}
      {fields.year && <span style={styles?.year}>({fields.year}). </span>}
      {doi && (
        <>
          <a href={doi.href} style={styleFor(DOI, styles?.doi, styleMode)}>
            doi:{doi.bare}
          </a>
          .
        </>
      )}
    </span>
  );

  switch (citationStyle) {
    case "APA":
      switch (entry.type) {
        case "article":
        case "book":
        case "booklet":
        case "conference":
        case "inbook":
        case "incollection":
        case "inproceedings":
        case "manual":
        case "mastersthesis":
        case "misc":
        case "phdthesis":
        case "proceedings":
        case "techreport":
        case "unpublished":
        default:
          return defaultRef();
      }
    case "MLA":
    case "Harvard":
    case "Chicago":
    default:
      return defaultRef();
  }
}
