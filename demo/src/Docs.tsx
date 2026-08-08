import type { ReactNode } from "react";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import latex from "react-syntax-highlighter/dist/esm/languages/prism/latex";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

// The light build ships no grammars, so the page only pays for these three.
SyntaxHighlighter.registerLanguage("tsx", tsx);
SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("latex", latex);

function Code({ language = "tsx", children }: { language?: string; children: string }) {
  return (
    <SyntaxHighlighter
      language={language}
      style={oneDark}
      customStyle={{
        margin: "0 0 1rem",
        borderRadius: 8,
        fontSize: "0.78rem",
        lineHeight: 1.6,
        padding: "0.85rem 1rem",
      }}
    >
      {children}
    </SyntaxHighlighter>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="docs__section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function Docs() {
  return (
    <div className="docs">
      <Section title="Install">
        <Code language="bash">{`npm install react-bibtex`}</Code>
        <p>
          React 18 or newer is a peer dependency. There is no stylesheet to import — every rule is
          an inline style you can override.
        </p>
      </Section>

      <Section title="A list of citations">
        <p>
          <code>BibTexList</code> takes BibTeX source as its child and renders one line per entry,
          each anchored so citation markers can link to it.
        </p>
        <Code>{`import { BibTexList } from "react-bibtex";

<BibTexList>{\`
  @article{erdos1959,
    author  = {Erd{\\\\H{o}}s, P.},
    title   = {On Random Graphs},
    journal = {Nature},
    year    = {1959},
  }
\`}</BibTexList>`}</Code>

        <table className="props">
          <tbody>
            <tr>
              <th>children</th>
              <td>
                <code>string</code> — BibTeX source holding any number of entries
              </td>
            </tr>
            <tr>
              <th>id</th>
              <td>
                anchor prefix; entry <em>n</em> becomes <code>ref-{"{id}"}-n</code> and links to{" "}
                <code>#cite-{"{id}"}-n</code>. Defaults to each entry&rsquo;s own BibTeX key.
              </td>
            </tr>
            <tr>
              <th>numbered</th>
              <td>
                <code>boolean</code> — render the markers. Default <code>true</code>
              </td>
            </tr>
            <tr>
              <th>separator</th>
              <td>
                <code>ReactNode</code> placed between entries. Default <code>{"<br />"}</code>
              </td>
            </tr>
            <tr>
              <th>styles</th>
              <td>per-slot overrides, merged over the defaults</td>
            </tr>
            <tr>
              <th>listStyle</th>
              <td>
                <code>CSSProperties</code> for the wrapping element
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="A single citation">
        <p>
          <code>BibTex</code> renders one entry, from source or from an already-parsed{" "}
          <code>BibEntry</code>. The two are mutually exclusive.
        </p>
        <Code>{`import { BibTex } from "react-bibtex";

<BibTex id="ref-1" refs={[{ n: 1, link: "#cite-1" }]}>
  {"@book{knuth1984, author={Knuth, D.}, title={Computers \\\\& Typesetting}, year=1984}"}
</BibTex>`}</Code>
        <p>
          If the source cannot be parsed, the component renders the parse error in place with{" "}
          <code>role=&quot;alert&quot;</code> instead of throwing.
        </p>
      </Section>

      <Section title="Styling">
        <p>
          Each fragment of a citation is a <em>slot</em>. Pass CSS objects for the slots you want to
          change; they are merged over the defaults, so partial overrides are fine.
        </p>
        <Code>{`<BibTexList
  styles={{
    title: { fontStyle: "normal", fontWeight: 600 },
    doi: { color: "#7c3aed" },
  }}
>
  {source}
</BibTexList>`}</Code>
        <p>
          The slots are <code>entry</code>, <code>marker</code>, <code>author</code>,{" "}
          <code>title</code>, <code>journal</code>, <code>volume</code>, <code>year</code> and{" "}
          <code>doi</code> — the panel on the left drives exactly this prop. Only{" "}
          <code>marker</code>, <code>title</code>, <code>journal</code> and <code>doi</code> carry
          default styling; the placeholder in each box is that default.
        </p>
        <p>
          By default an override is layered <em>over</em> its default, so a partial override keeps
          the rest. <code>styleMode="replace"</code> takes your object verbatim instead — the way to
          drop a default rather than restate it. It is decided per slot either way: a slot you leave
          alone keeps its default under both modes, and an empty object strips one slot.
        </p>
        <Code>{`// merge (default): italic survives, colour is added
<BibTexList styles={{ title: { color: "#b00" } }}>{source}</BibTexList>

// replace: red and upright, the italic default is gone
<BibTexList styleMode="replace" styles={{ title: { color: "#b00" } }}>{source}</BibTexList>`}</Code>
        <p>
          Every slot renders as a plain <code>&lt;span&gt;</code>. There is no{" "}
          <code>&lt;sup&gt;</code>, <code>&lt;em&gt;</code> or <code>&lt;strong&gt;</code> in the
          output — the superscript, italics and bold you see all come from{" "}
          <code>defaultStyles</code>, which makes it the whole visual contract: clear a box back to
          empty and you get the default, clear the default and the look is gone, with no tag styling
          left underneath. Try <code>vertical-align: baseline</code> on <code>marker</code>, or{" "}
          <code>font-style: normal</code> on <code>title</code>. The only non-spans are the{" "}
          <code>&lt;a&gt;</code> in a marker and in the DOI, which link rather than style.
        </p>
      </Section>

      <Section title="Parsing on its own">
        <p>The parser is exported if you want the data rather than the markup.</p>
        <Code>{`import { parseBibTex, parseBibTexList } from "react-bibtex";

const entries = parseBibTexList(source);
// [{ type: "article", key: "erdos1959", fields: { author: "...", ... } }]

const entry = parseBibTex(source);
// { type: "article", key: "erdos1959", fields: { author: "...", ... } }`}</Code>
        <p>
          Field names are lower-cased; values are kept as written. A malformed entry throws{" "}
          <code>BibTexParseError</code>, which carries the <code>position</code> in the source. A
          file with no entries at all throws <code>BibTexNoEntryError</code>, a subclass of it.
        </p>
      </Section>

      <Section title="What of BibTeX is understood">
        <Code language="latex">{`% comments run to the end of the line
@string{nat = "Nature"}          % macros, expanded where used
@preamble{"..."}                 % skipped
@comment{...}                    % skipped

@article{key,
  journal = nat # " Physics",    % concatenation with #
  month   = jan,                 % built-in month abbreviations
  title   = {Nested {Braces} kept together},
  note    = "quoted values too",
  year    = 2020,                % bare values
}`}</Code>
        <p>
          Entries delimited with parentheses, and <code>crossref</code> inheritance, are not
          supported.
        </p>
      </Section>

      <Section title="LaTeX in fields">
        <p>
          Field values reach the DOM as text, so the LaTeX around them is decoded first:{" "}
          <code>{"Erd{\\H{o}}s"}</code> renders as Erdős, <code>10--20</code> as 10–20, and{" "}
          <code>{"\\emph{x}"}</code> as x. Accents, ligatures, escaped symbols, dashes, quotes and
          inline math delimiters are handled; unrecognised commands are dropped and their arguments
          kept.
        </p>
        <Code>{`import { latexToText } from "react-bibtex";

latexToText("Caf\\\\'e \\\\& co.");   // "Café & co."`}</Code>
        <p>
          The DOI is deliberately left raw — it is an identifier, not prose. Author names are
          rendered as stored, so <code>Smith, J. and Doe, A.</code> appears verbatim; there is no
          citation-style engine here.
        </p>
      </Section>
    </div>
  );
}
