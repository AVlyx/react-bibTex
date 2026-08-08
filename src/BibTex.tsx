import { Fragment } from "react";
import { latexToText } from "./latex";
import { type BibEntry, parseBibTex } from "./parse";
import { type BibTexSlot, type BibTexStyles, type StyleMode, styleFor } from "./styles";

interface BibTexCommon {
  id?: string;
  refs?: {
    /** Citation number for the markers.*/
    n: number | string;
    /**ref link */
    link: string;
  }[];
  styles?: BibTexStyles;
  /** How `styles` combines with the defaults, per slot. Default `"merge"`. */
  styleMode?: StyleMode;
}

export type BibTexProps = BibTexCommon &
  ({ children: string; entry?: never } | { entry: BibEntry; children?: never });

/** Accepts a bare DOI or a full https://doi.org/... URL. */
const doiParts = (doi: string) => {
  const bare = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, "");
  return { bare, href: `https://doi.org/${bare}` };
};

export function BibTex({
  children,
  entry: parsed,
  refs,
  id,
  styles,
  styleMode = "merge",
}: BibTexProps) {
  const style = (slot: BibTexSlot) => styleFor(slot, styles, styleMode);

  let entry: BibEntry;
  try {
    entry = parsed ?? parseBibTex(children ?? "");
  } catch (error) {
    return (
      <span role="alert" style={style("entry")}>
        {error instanceof Error ? error.message : "Could not read this BibTeX source."}
      </span>
    );
  }

  const { type, fields } = entry;
  const doi = fields.doi ? doiParts(fields.doi) : undefined;
  // The DOI is deliberately left raw: it is an identifier, not prose.
  const text = (field: string) => (field ? latexToText(field) : field);

  return (
    <span id={id} style={style("entry")} data-type={type}>
      {refs?.map(({ n, link }) => (
        <Fragment key={link}>
          <span style={style("marker")}>
            <a href={link}>{n}</a>
          </span>{" "}
        </Fragment>
      ))}
      {fields.author && <span style={style("author")}>{text(fields.author)}. </span>}
      {fields.title && (
        <>
          <span style={style("title")}>{text(fields.title)}</span>.{" "}
        </>
      )}
      {fields.journal && (
        <>
          <span style={style("journal")}>{text(fields.journal)}</span>.{" "}
        </>
      )}
      {fields.volume && (
        <span style={style("volume")}>
          vol. {text(fields.volume)}
          {fields.number && `(${text(fields.number)})`}.{" "}
        </span>
      )}
      {fields.year && <span style={style("year")}>({text(fields.year)}). </span>}
      {doi && (
        <>
          <a href={doi.href} style={style("doi")}>
            doi:{doi.bare}
          </a>
          .
        </>
      )}
    </span>
  );
}
