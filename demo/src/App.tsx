import { useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";
import {
  BibTexList,
  defaultStyles,
  parseBibTexList,
  type BibTexStyles,
  type StyleMode,
} from "react-bibtex";

import { Docs } from "./Docs";
import { Splitter } from "./Splitter";
import { parseDeclarations } from "./css";
import { sampleBibTex } from "./sample";

type Slot = keyof typeof defaultStyles;

const slots = Object.keys(defaultStyles) as Slot[];

const hints: Record<Slot, string> = {
  entry: "the whole citation",
  marker: "the [1] superscript",
  author: "author list",
  title: "title",
  journal: "journal name",
  volume: "volume and number",
  year: "year",
  doi: "doi link",
};

/** The library's own defaults, shown as placeholders. */
const defaultsAsCss = (slot: Slot) => {
  const entries = Object.entries(defaultStyles[slot]);
  if (entries.length === 0) return "unstyled";
  return entries
    .map(
      ([property, value]) =>
        `${property.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}: ${value}`,
    )
    .join("; ");
};

const emptyCss = Object.fromEntries(slots.map((slot) => [slot, ""])) as Record<Slot, string>;

export function App() {
  const [source, setSource] = useState(sampleBibTex);
  const [slotCss, setSlotCss] = useState<Record<Slot, string>>(emptyCss);
  const [listCss, setListCss] = useState("line-height: 1.9");
  const [numbered, setNumbered] = useState(true);
  const [styleMode, setStyleMode] = useState<StyleMode>("merge");
  const [dropping, setDropping] = useState(false);

  const layoutRef = useRef<HTMLDivElement>(null);
  const [col, setCol] = useState(50);
  const [row, setRow] = useState(50);

  const styles = useMemo(() => {
    const result: BibTexStyles = {};
    for (const slot of slots) {
      const declarations = parseDeclarations(slotCss[slot]);
      if (Object.keys(declarations).length > 0) result[slot] = declarations;
    }
    return result;
  }, [slotCss]);

  const listStyle = useMemo(() => parseDeclarations(listCss), [listCss]);

  const count = useMemo(() => {
    try {
      return parseBibTexList(source).length;
    } catch {
      return null;
    }
  }, [source]);

  const setSlot = (slot: Slot, value: string) =>
    setSlotCss((previous) => ({ ...previous, [slot]: value }));

  // A textarea takes dropped *text* on its own, but a dropped file would
  // otherwise navigate the page away, so read it here instead.
  const holdsFile = (event: DragEvent) => event.dataTransfer.types.includes("Files");

  const onDragOver = (event: DragEvent) => {
    if (!holdsFile(event)) return;
    event.preventDefault();
    setDropping(true);
  };

  const onDrop = async (event: DragEvent) => {
    if (!holdsFile(event)) return;
    event.preventDefault();
    setDropping(false);

    const file = event.dataTransfer.files[0];
    if (file) setSource(await file.text());
  };

  // The splitters read these back out of the cascade to place themselves. The
  // narrow layout overrides the templates, so the values simply go unused.
  const tracks = { "--col": `${col}%`, "--row": `${row}%` } as CSSProperties;

  return (
    <div className="layout" ref={layoutRef} style={tracks}>
      <section className="panel panel--docs">
        <header className="panel__head">
          <h2>Documentation</h2>
          <p>
            <a href="https://github.com/AVlyx/react-bibTex">github.com/AVlyx/react-bibTex</a>
          </p>
        </header>

        <div className="panel__body">
          <Docs />
        </div>
      </section>

      <section className="panel panel--source">
        <header className="panel__head">
          <h2>BibTeX</h2>
          <p>
            Paste or drop a <code>.bib</code> file here.
            {count !== null && (
              <>
                {" "}
                <strong>
                  {count} {count === 1 ? "entry" : "entries"}
                </strong>
              </>
            )}
          </p>
          <button type="button" className="ghost" onClick={() => setSource(sampleBibTex)}>
            Restore sample
          </button>
        </header>

        <div className={`panel__body panel__body--flush${dropping ? " is-dropping" : ""}`}>
          <textarea
            className="source"
            spellCheck={false}
            value={source}
            onChange={(event) => setSource(event.target.value)}
            onDragOver={onDragOver}
            onDragLeave={() => setDropping(false)}
            onDrop={onDrop}
            aria-label="BibTeX source"
          />
        </div>
      </section>

      <section className="panel panel--styles">
        <header className="panel__head">
          <h2>Styles</h2>
          <p>
            CSS declarations per slot,{" "}
            {styleMode === "replace" ? "replacing the defaults" : "merged over the defaults"}. Try{" "}
            <code>color: crimson; font-variant: small-caps</code>.
          </p>
          <button type="button" className="ghost" onClick={() => setSlotCss(emptyCss)}>
            Reset
          </button>
        </header>

        <div className="panel__body">
          <div className="fields">
            {slots.map((slot) => (
              <label key={slot} className="field">
                <span className="field__name">
                  {slot}
                  <em>{hints[slot]}</em>
                </span>
                <input
                  type="text"
                  spellCheck={false}
                  value={slotCss[slot]}
                  placeholder={defaultsAsCss(slot)}
                  onChange={(event) => setSlot(slot, event.target.value)}
                />
              </label>
            ))}

            <label className="field field--divided">
              <span className="field__name">
                listStyle
                <em>the wrapping element</em>
              </span>
              <input
                type="text"
                spellCheck={false}
                value={listCss}
                placeholder="unstyled"
                onChange={(event) => setListCss(event.target.value)}
              />
            </label>
          </div>

          <label className="toggle">
            <input
              type="checkbox"
              checked={numbered}
              onChange={(event) => setNumbered(event.target.checked)}
            />
            <span>
              <code>numbered</code> — render the citation markers
            </span>
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={styleMode === "replace"}
              onChange={(event) => setStyleMode(event.target.checked ? "replace" : "merge")}
            />
            <span>
              <code>styleMode="replace"</code> — a box you fill in replaces that slot's default
              instead of layering over it. Slots you leave empty keep theirs either way.
            </span>
          </label>
        </div>
      </section>

      <section className="panel panel--result">
        <header className="panel__head">
          <h2>Result</h2>
          <p>Rendered by &lt;BibTexList&gt;. Malformed input renders its error in place.</p>
        </header>

        <div className="panel__body">
          <div className="result">
            <BibTexList
              numbered={numbered}
              styles={styles}
              styleMode={styleMode}
              listStyle={listStyle}
            >
              {source}
            </BibTexList>
          </div>
        </div>
      </section>

      <Splitter axis="col" value={col} onChange={setCol} containerRef={layoutRef} />
      <Splitter axis="row" value={row} onChange={setRow} containerRef={layoutRef} />
    </div>
  );
}
