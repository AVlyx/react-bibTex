# react-bibtex

[![npm](https://img.shields.io/npm/v/react-bibtex.svg)](https://www.npmjs.com/package/react-bibtex)

Render BibTeX entries as React elements. Paste `.bib` source in, get citation lines out — with
the LaTeX decoded, every fragment styleable, and no stylesheet to import.

**[Playground →](https://avlyx.github.io/react-bibTex/)**

```tsx
<BibTexList>{`
  @article{erdos1959,
    author  = {Erd{\H{o}}s, Paul and R{\'e}nyi, Alfr{\'e}d},
    title   = {On Random Graphs {I}},
    journal = {Nature},
    year    = {1959},
  }
`}</BibTexList>
```

> <sup>1</sup> Erdős, Paul and Rényi, Alfréd. *On Random Graphs I*. **Nature**. (1959).

## Install

```bash
npm install react-bibtex
```

React 18 or newer is a peer dependency. The package ships ESM and CJS builds with types for both.

## Components

### `<BibTexList>`

Takes BibTeX source as its child and renders one line per entry, each anchored so in-text
citations can link to it.

```tsx
import { BibTexList } from "react-bibtex";

<BibTexList id="bib" styles={{ title: { fontStyle: "normal" } }}>
  {bibSource}
</BibTexList>;
```

| prop | type | default | |
| --- | --- | --- | --- |
| `children` | `string` | — | BibTeX source holding any number of entries |
| `id` | `string` | entry key | Anchor prefix. Entry *n* gets `id="ref-{id}-{n}"` and its marker links to `#cite-{id}-{n}` |
| `numbered` | `boolean` | `true` | Render the citation markers |
| `separator` | `ReactNode` | `<br />` | Placed between entries |
| `styles` | `BibTexStyles` | — | Per-slot overrides, merged over the defaults |
| `styleMode` | `"merge" \| "replace"` | `"merge"` | Whether an override layers over its default or takes its place |
| `listStyle` | `CSSProperties` | — | Style for the wrapping element |

### `<BibTex>`

One entry, from source or from an already-parsed `BibEntry`. The two are mutually exclusive.

```tsx
import { BibTex } from "react-bibtex";

<BibTex id="ref-1" refs={[{ n: 1, link: "#cite-1" }]}>
  {"@book{knuth1984, author={Knuth, D.}, title={Computers \\& Typesetting}, year=1984}"}
</BibTex>;
```

| prop | type | |
| --- | --- | --- |
| `children` | `string` | BibTeX source for a single entry |
| `entry` | `BibEntry` | A parsed entry, instead of `children` |
| `id` | `string` | `id` for the wrapping element |
| `refs` | `{ n: number \| string; link: string }[]` | Superscript markers linking back to the citation sites |
| `styles` | `BibTexStyles` | Per-slot overrides |
| `styleMode` | `"merge" \| "replace"` | How overrides combine with the defaults. Default `"merge"` |

Neither component throws on bad input. A parse failure renders the error message in place —
`<BibTex>` uses `role="alert"` — so one broken entry cannot take a page down.

## Styling

Every fragment of a citation is a **slot**. Pass CSS objects for the slots you want to change;
they are merged over the defaults, so partial overrides are fine.

```tsx
<BibTexList
  styles={{
    title: { fontStyle: "normal", fontWeight: 600 },
    doi: { color: "#7c3aed" },
  }}
>
  {bibSource}
</BibTexList>
```

| slot | covers | default |
| --- | --- | --- |
| `entry` | the whole citation | — |
| `marker` | citation number | `vertical-align: super; font-size: smaller` |
| `author` | author list | — |
| `title` | title | `font-style: italic` |
| `journal` | journal name | `font-weight: 700` |
| `volume` | volume and number | — |
| `year` | year | — |
| `doi` | DOI link | `color: #1a73e8; text-decoration: none` |

Every slot renders as a plain `<span>` — there is no `<sup>`, `<em>` or `<strong>` in the output,
so the superscript, italics and bold above come from `defaultStyles` and nothing else. The table
is the whole visual contract: what you read there is what renders, and setting a slot to `{}`
strips its look completely, with no tag defaults left underneath to surprise you. The only
elements that are not spans are the `<a>` for a marker and for the DOI, which link rather than
style.

### `styleMode`

By default an override is layered **over** its default, so a partial override keeps the rest.
`styleMode="replace"` takes your object verbatim instead, which is how you drop a default rather
than restate it:

```tsx
// merge (default): italic survives, colour is added
<BibTexList styles={{ title: { color: "#b00" } }}>{bibSource}</BibTexList>

// replace: the title is red and upright, the italic default is gone
<BibTexList styleMode="replace" styles={{ title: { color: "#b00" } }}>{bibSource}</BibTexList>
```

Either way this is decided **per slot**. A slot you say nothing about keeps its default under both
modes — `replace` above still leaves `journal` bold and the DOI blue. To strip a single slot,
give it an empty object: `styles={{ marker: {} }}` with `styleMode="replace"` renders the citation
number inline instead of superscripted.

The wrapping element carries `data-type` (the entry type), so you can also reach entries from a
stylesheet: `[data-type="book"] { … }`.

A citation renders `author`, `title`, `journal`, `volume`, `number`, `year` and `doi`. Other
fields are parsed and available through the parser, but not shown.

## Parsing on its own

```tsx
import { parseBibTex, parseBibTexList } from "react-bibtex";

const entries = parseBibTexList(source);
// [{ type: "article", key: "erdos1959", fields: { author: "…", title: "…" } }]

const entry = parseBibTex(source);
// { type: "article", key: "erdos1959", fields: { author: "…", title: "…" } }
```

- **`parseBibTexList(source)`** → every entry in the source, as a `BibEntry[]`.
- **`parseBibTex(source)`** → the first entry in the source, as a single `BibEntry`.

Entry types and field names are lower-cased; values are kept as written. A malformed entry throws
`BibTexParseError`, which carries a `position` in the source. A source with no entries at all
throws `BibTexNoEntryError`, a subclass of it — `parseBibTexList` treats that as an empty result
rather than an error.

## What of BibTeX is understood

```bibtex
% comments run to the end of the line, even ones mentioning @article
@string{nat = "Nature"}          % macros, expanded where used
@preamble{"..."}                 % skipped
@comment{...}                    % skipped

@article{key,
  journal = nat # " Physics",    % concatenation with #
  month   = jan,                 % built-in month abbreviations
  title   = {Nested {Braces} kept together},
  note    = "quoted values work too",
  year    = 2020,                % bare values
}                                % a trailing comma is fine
```

Not supported: entries delimited with parentheses — `@article(key, …)` — and `crossref`
inheritance between entries.

## LaTeX in fields

Field values reach the DOM as text, so the LaTeX around them is decoded first. Accents,
ligatures, escaped symbols, dashes, quotes and inline math delimiters are handled; unrecognised
commands are dropped and their arguments kept.

```tsx
import { latexToText } from "react-bibtex";

latexToText("Erd{\\H{o}}s");        // "Erdős"
latexToText("Fran\\c{c}ois");       // "François"
latexToText("Computers \\& Type");  // "Computers & Type"
latexToText("10--20");              // "10–20"
latexToText("\\emph{n}-body");      // "n-body"
```

Two deliberate exceptions: the DOI is left raw, because it is an identifier rather than prose;
and author names render as stored, so `Smith, J. and Doe, A.` appears verbatim. There is no
citation-style engine here — if you need APA or MLA output, you want
[citation-js](https://citation.js.org/).

## Exports

`BibTex`, `BibTexList`, `parseBibTex`, `parseBibTexList`, `latexToText`, `defaultStyles`,
`BibTexParseError`, `BibTexNoEntryError`, and the types `BibTexProps`, `BibTexListProps`,
`BibEntry`, `BibTexSlot`, `BibTexStyles`, `StyleMode`.

## Development

```bash
npm test         # builds, then runs the test suite
npm run build    # ESM + CJS + declarations, via tsup
npm run typecheck
```

The playground in [`demo/`](demo) is a Vite app that compiles the library from `src/` directly,
so edits show up live:

```bash
npm --prefix demo install
npm --prefix demo run dev
```

`npm --prefix demo run build` emits `demo/dist`, ready for GitHub Pages. Asset URLs are relative,
so it works from any sub-path.

## License

MIT © AVlyx
