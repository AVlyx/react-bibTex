/**
 * Turns the LaTeX fragments that live in `.bib` fields into display text:
 * `A {Nested} Title` -> `A Nested Title`, `Erd{\H{o}}s` -> `Erdős`, `10--20` -> `10–20`.
 *
 * This covers what shows up in practice, not all of TeX. Unrecognised commands
 * are dropped and their arguments kept, which is the least surprising outcome
 * for a citation line.
 */

/** Accent commands, as the combining mark they place on the following letter. */
const accents: Record<string, string> = {
  "'": "́", // acute
  "`": "̀", // grave
  "^": "̂", // circumflex
  '"': "̈", // diaeresis
  "~": "̃", // tilde
  "=": "̄", // macron
  ".": "̇", // dot above
  u: "̆", // breve
  v: "̌", // caron
  H: "̋", // double acute
  c: "̧", // cedilla
  k: "̨", // ogonek
  d: "̣", // dot below
  b: "̱", // macron below
  r: "̊", // ring above
};

/** Letters and ligatures with no combining-mark equivalent. */
const letters: Record<string, string> = {
  aa: "å",
  AA: "Å",
  ae: "æ",
  AE: "Æ",
  oe: "œ",
  OE: "Œ",
  ss: "ß",
  th: "þ",
  TH: "Þ",
  dh: "ð",
  DH: "Ð",
  ng: "ŋ",
  NG: "Ŋ",
  o: "ø",
  O: "Ø",
  l: "ł",
  L: "Ł",
  // Dotless forms exist only to carry an accent, so plain letters read better.
  i: "i",
  j: "j",
};

/** Styling commands we drop, keeping the argument. */
const wrappers =
  /\\(?:emph|textit|textbf|textsc|textrm|texttt|textmd|textup|textsl|textnormal|textsuperscript|textsubscript|mbox|hbox|text|url|href|acronym)\s*\{([^{}]*)\}/g;

const symbols: Record<string, string> = {
  "&": "&",
  "%": "%",
  $: "$",
  "#": "#",
  _: "_",
  "{": "{",
  "}": "}",
  " ": " ",
};

const applyAccent = (base: string, mark: string): string => {
  const target = base.trim();
  if (!target) return mark;
  return (target[0] + mark + target.slice(1)).normalize("NFC");
};

const escapeForClass = (key: string) => key.replace(/[.^$*+?()[\]{}|\\]/g, "\\$&");

const accentKeys = Object.keys(accents).map(escapeForClass).join("|");

/** Longest first, so `\aa` is not read as `\a` followed by `a`. */
const letterKeys = Object.keys(letters)
  .sort((a, b) => b.length - a.length)
  .join("|");

export function latexToText(source: string): string {
  let text = source;

  // Escaped characters are parked behind NUL markers, out of reach of the later
  // steps — brace stripping, unknown-command removal — that would otherwise
  // mistake them for markup. NUL does not occur in the surrounding text.
  const parked: string[] = [];
  const park = (value: string) => "\0" + (parked.push(value) - 1) + "\0";

  text = text.replace(/\\textbackslash(?:\{\})?/g, () => park("\\"));
  text = text.replace(/\\([&%$#_{} ])/g, (_, c: string) => park(symbols[c] ?? c));

  // TeX swallows whatever ends a control word, so `\ae dia` is one word.
  text = text.replace(
    new RegExp(`\\\\(${letterKeys})(?![a-zA-Z])(?:\\{\\}|[ \\t]+)?`, "g"),
    (_, name) => String(letters[name]),
  );

  // `\'{e}` / `\'e` / `\c{c}` / `\c c`. Symbol accents bind to a bare character;
  // letter accents need a brace or a space to end the command name.
  text = text.replace(
    new RegExp(`\\\\(${accentKeys})\\s*\\{([^{}]*)\\}`, "g"),
    (_, mark: string, base: string) => applyAccent(base, String(accents[mark])),
  );
  text = text.replace(
    /\\(['`^"~=.])\s*([^\s{}\\])/g,
    (_, mark: string, base: string) => applyAccent(base, String(accents[mark])),
  );
  text = text.replace(
    /\\([uvHckdbr])\s+([^\s{}\\])/g,
    (_, mark: string, base: string) => applyAccent(base, String(accents[mark])),
  );

  text = text.replace(/\$([^$]*)\$/g, "$1"); // inline math delimiters
  text = text.replace(/---/g, "—").replace(/--/g, "–");
  text = text.replace(/``/g, "“").replace(/''/g, "”");
  text = text.replace(/~/g, " "); // LaTeX's unbreakable space

  // Nested styling needs more than one pass: \textbf{\emph{x}}.
  for (let pass = 0; pass < 4; pass++) {
    const unwrapped = text.replace(wrappers, "$1");
    if (unwrapped === text) break;
    text = unwrapped;
  }

  text = text.replace(/\\[a-zA-Z]+\s*/g, ""); // anything still unrecognised
  text = text.replace(/[{}]/g, "");
  text = text.replace(/\s+/g, " ").trim();

  text = text.replace(/\0(\d+)\0/g, (_, n: string) => parked[Number(n)] ?? "");

  return text.normalize("NFC");
}
