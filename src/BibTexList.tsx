import { CSSProperties, Fragment, type ReactNode } from "react";
import { BibTex } from "./BibTex";
import { parseAll, type BibEntry } from "./parse";
import { type BibTexStyles } from "./styles";

export interface BibTexListProps {
  /** BibTeX source holding any number of entries. */
  children: string;
  /**
   * Anchor prefix. Entry n gets `id="ref-{id}-{n}"` and its marker links to
   * `#cite-{id}-{n}`. Without it, the entry's own BibTeX key is used.
   */
  id?: string;
  /** Render numbered markers. Default true. */
  numbered?: boolean;
  /** Placed between entries. Default `<br />`. */
  separator?: ReactNode;
  /** Per-slot style overrides, merged over the defaults. */
  styles?: BibTexStyles;
  listStyle?: CSSProperties;
}

export function BibTexList({
  children,
  id,
  numbered = true,
  separator = <br />,
  styles,
  listStyle,
}: BibTexListProps) {
  let entries: BibEntry[];
  try {
    entries = parseAll(children);
  } catch (error) {
    return (
      <p style={listStyle}>
        {error instanceof Error ? error.message : "Could not read this BibTeX source."}
      </p>
    );
  }

  return (
    <p style={listStyle}>
      {entries.map((entry, index) => {
        const n = index + 1;
        const anchor = id ? `${id}-${n}` : entry.key;

        return (
          <Fragment key={entry.key}>
            {index > 0 && separator}
            <BibTex
              entry={entry}
              id={`ref-${anchor}`}
              refs={numbered ? [{ n, link: `#cite-${anchor}` }] : undefined}
              styles={styles}
            />
          </Fragment>
        );
      })}
    </p>
  );
}
