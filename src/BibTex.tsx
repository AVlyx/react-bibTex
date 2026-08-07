import { Fragment } from "react";
import { BibEntry, parse } from "./parse";
import { BibTexStyles, styleFor } from "./styles";

interface BibTexCommon {
  id?: string;
  refs?: {
    /** Citation number for the markers.*/
    n: number | string;
    /**ref link */
    link: string;
  }[];
  styles?: BibTexStyles;
}

export type BibTexProps = BibTexCommon &
  ({ children: string; entry?: never } | { entry: BibEntry; children?: never });

/** Accepts a bare DOI or a full https://doi.org/... URL. */
const doiParts = (doi: string) => {
  const bare = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, "");
  return { bare, href: `https://doi.org/${bare}` };
};

export function BibTex({ children, entry: parsed, refs, id, styles }: BibTexProps) {
  let entry: BibEntry;
  try {
    entry = parsed ?? parse(children ?? "").bibEntry;
  } catch (error) {
    return (
      <span role="alert" style={styleFor("entry", styles)}>
        {error instanceof Error ? error.message : "Could not read this BibTeX source."}
      </span>
    );
  }

  const { type, fields } = entry;
  const doi = fields.doi ? doiParts(fields.doi) : undefined;

  return (
    <span id={id} style={styleFor("entry")} data-type={type}>
      {refs?.map(({ n, link }) => (
        <Fragment key={link}>
          <sup style={styleFor("marker")}>
            <a href={link}>{n}</a>
          </sup>{" "}
        </Fragment>
      ))}
      {fields.author && <span style={styleFor("author")}>{fields.author}. </span>}
      {fields.title && (
        <>
          <em style={styleFor("title")}>{fields.title}</em>.{" "}
        </>
      )}
      {fields.journal && (
        <>
          <strong style={styleFor("journal")}>{fields.journal}</strong>.{" "}
        </>
      )}
      {fields.volume && (
        <span style={styleFor("volume")}>
          vol. {fields.volume}
          {fields.number && `(${fields.number})`}.{" "}
        </span>
      )}
      {fields.year && <span style={styleFor("year")}>({fields.year}). </span>}
      {doi && (
        <>
          <a href={doi.href} style={styleFor("doi")}>
            doi:{doi.bare}
          </a>
          .
        </>
      )}
    </span>
  );
}
