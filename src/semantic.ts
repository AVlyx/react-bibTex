import { BibTexNoEntryError, findNextBlock, parseBlock, parseValue } from "./parse.ts";
import type { BibEntry, Block, Entries, Group, Latex, Macro, MacroDef, Text } from "./parse.ts";

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
const wrappers = new Set([
  "emph",
  "textit",
  "textbf",
  "textsc",
  "textrm",
  "texttt",
  "textmd",
  "textup",
  "textsl",
  "textnormal",
  "textsuperscript",
  "textsubscript",
  "mbox",
  "hbox",
  "text",
  "url",
  "href",
  "acronym",
]);

/** Commands that stand for one literal character. */
const symbols: Record<string, string> = {
  "&": "&",
  "%": "%",
  $: "$",
  "#": "#",
  _: "_",
  "{": "{",
  "}": "}",
  " ": " ",
  textbackslash: "\\",
};

export type BibTexMacros = Record<string, string>;

/** BibTeX predefines these; a `.bib` file may still override them with `@string`. */
export const builtinMacros: BibTexMacros = {
  jan: "January",
  feb: "February",
  mar: "March",
  apr: "April",
  may: "May",
  jun: "June",
  jul: "July",
  aug: "August",
  sep: "September",
  oct: "October",
  nov: "November",
  dec: "December",
};

/**
 * Splits a parsed document into what the two kinds of block contribute.
 * `ignored` blocks — `@comment`, `@preamble` — carry nothing and drop out.
 * Both lists keep source order, which is what makes macro scope work below.
 */
export function extractBlocks(blocks: Block[]): {
  entries: Entries[];
  macros: MacroDef[];
} {
  const entries: Entries[] = [];
  const macros: MacroDef[] = [];

  for (const block of blocks) {
    if (block.kind === "entry") entries.push(block.entry);
    else if (block.kind === "macro") macros.push(block.macro);
  }

  return { entries, macros };
}

/** Places `mark` on the first letter of `base`, as one composed character. */
function applyAccent(base: string, mark: string): string {
  const target = base.trim();
  if (!target) return mark;
  return (target[0] + mark + target.slice(1)).normalize("NFC");
}

/**
 * Conventions that live in the literal text rather than in a command. Escaped
 * characters are already their own tokens by now, so `\%` cannot be mistaken
 * for markup here and needs no protecting.
 */
function plainText(source: string): string {
  return source
    .replace(/---/g, "—")
    .replace(/--/g, "–")
    .replace(/``/g, "“")
    .replace(/''/g, "”")
    .replace(/~/g, " ") // LaTeX's unbreakable space
    .replace(/\$/g, ""); // inline math delimiters
}

/**
 * One command as display text. Anything unrecognised is dropped and its
 * argument kept, which is the least surprising outcome for a citation line.
 */
export function latexToString(latex: Latex, macros: MacroDef[]): string {
  const inner = latex.inner ? textToString(latex.inner, macros) : "";

  const accent = accents[latex.command];
  if (accent) return applyAccent(inner, accent);

  const letter = letters[latex.command];
  if (letter) return letter + inner;

  const symbol = symbols[latex.command];
  if (symbol) return symbol + inner;

  // Nesting needs no extra passes: `inner` is already rendered.
  if (wrappers.has(latex.command)) return inner;

  return inner;
}

/** Braces only group, so the content stands in for them. */
export function groupToString(group: Group, macros: MacroDef[]): string {
  return textToString(group.inner, macros);
}

/**
 * A bare name: an `@string` definition, a built-in month, or — when it is
 * neither, as with a bare year — the name itself.
 *
 * A definition may only use names defined before it, so resolution walks
 * backwards and hands on the earlier definitions alone. That takes the most
 * recent definition of a name and makes a cycle impossible to write.
 */
export function macroToString(macro: Macro, macros: MacroDef[]): string {
  const name = macro.macro.toLowerCase();

  for (let i = macros.length - 1; i >= 0; i--) {
    if (macros[i].macro === name) return textToString(macros[i].value, macros.slice(0, i));
  }

  return builtinMacros[name] ?? macro.macro;
}

/** A run of tokens as display text, with no whitespace tidying. */
export function textToString(text: Text, macros: MacroDef[]): string {
  // A copy: an accent consumes part of the token after it, and the caller's
  // tokens have to survive that.
  const tokens = [...text];
  let out = "";

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (typeof token === "string") {
      out += plainText(token);
      continue;
    }
    if ("macro" in token) {
      out += macroToString(token, macros);
      continue;
    }
    if ("command" in token) {
      // An accent with no argument takes the letter that follows it: `\'e`.
      const accent = token.inner === undefined ? accents[token.command] : undefined;
      const next = tokens[i + 1];
      if (accent && typeof next === "string" && next.trim() !== "") {
        const iLetter = next.search(/\S/);
        out += applyAccent(next[iLetter], accent);
        tokens[i + 1] = next.slice(iLetter + 1);
        continue;
      }
      out += latexToString(token, macros);
      continue;
    }
    out += groupToString(token, macros);
  }

  return out;
}

/**
 * A field value as the text to display, from lexed tokens or from the LaTeX
 * they were lexed from. Whitespace is collapsed only here, so that the
 * recursion above cannot trim the space between two fragments.
 */
export function latexToText(source: string | Text, macros: MacroDef[] = []): string {
  const text = typeof source === "string" ? parseValue(`{${source}},`, 0)[0] : source;
  return textToString(text, macros).replace(/\s+/g, " ").trim().normalize("NFC");
}

/** Every block of a document, in source order. */
export function parseBlocks(bibtex: string): Block[] {
  const blocks: Block[] = [];

  let i = findNextBlock(bibtex, 0);
  while (i !== -1) {
    const [block, iEnd] = parseBlock(bibtex, i + 1);
    blocks.push(block);
    i = findNextBlock(bibtex, iEnd);
  }

  return blocks;
}

/** An entry with each field resolved against the macros in scope for it. */
function toBibEntry(entry: Entries, macros: MacroDef[]): BibEntry {
  const fields: Record<string, string> = {};
  for (const name of Object.keys(entry.fields)) {
    fields[name] = latexToText(entry.fields[name], macros);
  }
  return { type: entry.type, key: entry.key, fields };
}

/** Every entry in a document, with its fields decoded to display text. */
export function parseBibTexList(bibtex: string): BibEntry[] {
  const entries: BibEntry[] = [];
  const macros: MacroDef[] = [];

  for (const block of parseBlocks(bibtex)) {
    if (block.kind === "macro") macros.push(block.macro);
    // Resolved here rather than at the end: a macro defined after an entry is
    // not in scope for it, and resolving eagerly keeps that true.
    else if (block.kind === "entry") entries.push(toBibEntry(block.entry, macros));
  }

  return entries;
}

/**
 * The first entry of a document. Blocks before it still count — a `@string` it
 * relies on, say — but nothing after it is read.
 */
export function parseBibTex(bibtex: string): BibEntry {
  const macros: MacroDef[] = [];

  let i = findNextBlock(bibtex, 0);
  while (i !== -1) {
    const [block, iEnd] = parseBlock(bibtex, i + 1);
    if (block.kind === "entry") return toBibEntry(block.entry, macros);
    if (block.kind === "macro") macros.push(block.macro);
    i = findNextBlock(bibtex, iEnd);
  }

  throw new BibTexNoEntryError("found no bibliography entry", bibtex.length);
}
