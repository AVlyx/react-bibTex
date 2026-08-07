import { Fragment } from "react";
import { type BibEntry, parse } from "./parse";
import { type BibTexSlot, type BibTexStyles, styleFor } from "./styles";

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
  const style = (slot: BibTexSlot) => styleFor(slot, styles);

  let entry: BibEntry;
  try {
    entry = parsed ?? parse(children ?? "").bibEntry;
  } catch (error) {
    return (
      <span role="alert" style={style("entry")}>
        {error instanceof Error ? error.message : "Could not read this BibTeX source."}
      </span>
    );
  }

  const { type, fields } = entry;
  const doi = fields.doi ? doiParts(fields.doi) : undefined;

  return (
    <span id={id} style={style("entry")} data-type={type}>
      {refs?.map(({ n, link }) => (
        <Fragment key={link}>
          <sup style={style("marker")}>
            <a href={link}>{n}</a>
          </sup>{" "}
        </Fragment>
      ))}
      {fields.author && <span style={style("author")}>{fields.author}. </span>}
      {fields.title && (
        <>
          <em style={style("title")}>{fields.title}</em>.{" "}
        </>
      )}
      {fields.journal && (
        <>
          <strong style={style("journal")}>{fields.journal}</strong>.{" "}
        </>
      )}
      {fields.volume && (
        <span style={style("volume")}>
          vol. {fields.volume}
          {fields.number && `(${fields.number})`}.{" "}
        </span>
      )}
      {fields.year && <span style={style("year")}>({fields.year}). </span>}
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
