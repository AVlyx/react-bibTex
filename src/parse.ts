import type { BibTexPublication } from "./styles";

export interface BibEntry {
  type: BibTexPublication;
  key: string;
  fields: Record<string, string>;
}

export class BibTexParseError extends Error {
  readonly position: number;

  constructor(message: string, position: number) {
    super(`${message} (at index ${position})`);
    this.name = "BibTexParseError";
    this.position = position;
  }
}

/** The source held no bibliography entry — possibly only `@string`/`@comment`. */
export class BibTexNoEntryError extends BibTexParseError {
  constructor(message: string, position: number) {
    super(message, position);
    this.name = "BibTexNoEntryError";
  }
}

/**
 * Index of the first character at or after `i` that is neither whitespace nor
 * part of a `%` comment. Returns `bibtex.length` when nothing but skippable
 * text is left, so the result is always a usable index.
 */
export function skipWhitespace(bibtex: string, i: number): number {
  while (i < bibtex.length) {
    if (/\s/.test(bibtex[i])) {
      i++;
      continue;
    }
    if (bibtex[i] === "%") {
      while (i < bibtex.length && bibtex[i] !== "\n") i++;
      continue;
    }
    return i;
  }
  return bibtex.length;
}

function fail(message: string, i: number): never {
  throw new BibTexParseError(message, i);
}

/** What sits at `i`, for error messages that must not read `undefined`. */
function at(bibtex: string, i: number): string {
  return i < bibtex.length ? bibtex[i] : "end of input";
}

export function expect(bibtex: string, i: number, char: string) {
  i = skipWhitespace(bibtex, i);
  if (bibtex[i] != char) fail(`expected ${char}`, i);
  return skipWhitespace(bibtex, i + 1);
}

/**
 * Entry keys, field names and macro names run until a character that means
 * something to BibTeX.
 */
const nameChar = /[^\s"#%'(),={}\\]/;

export function parseToken(bibtex: string, i: number): [string, number] {
  i = skipWhitespace(bibtex, i);
  const startIndex = i;
  while (i < bibtex.length && nameChar.test(bibtex[i])) {
    i++;
  }
  return [bibtex.slice(startIndex, i), i];
}

export type Text = (Macro | Latex | Group | string)[];
export interface Macro {
  macro: string;
}
export interface Latex {
  command: string;
  inner?: Text;
}
export interface Group {
  inner: Text;
}

/**
 * Content up to the unescaped `end` delimiter, with `i` just past the opening
 * one. Returns the index after the delimiter it consumed.
 */
export function parseInnerLatex(bibtex: string, i: number, end: string): [Text, number] {
  let inner = "";
  const tokens: Text = [];

  const flush = () => {
    if (inner !== "") {
      tokens.push(inner);
      inner = "";
    }
  };

  while (i < bibtex.length) {
    const char = bibtex[i];
    if (char === end) {
      flush();
      return [tokens, i + 1];
    }
    if (char === "\\") {
      flush();
      const [latex, iLatexEnd] = parseLatex(bibtex, i + 1);
      tokens.push(latex);
      i = iLatexEnd;
      continue;
    }
    if (char === "{") {
      flush();
      const [group, iGroupEnd] = parseInnerLatex(bibtex, i + 1, "}");
      tokens.push({ inner: group });
      i = iGroupEnd;
      continue;
    }
    if (char === "}") {
      fail("unexpected '}'", i);
    }
    inner += char;
    i++;
  }
  fail(`expected ${end}`, i);
}

/**
 * A command, with `i` just past its backslash. Control words run over letters
 * and swallow one following space; control symbols (`\&`, `\'`) are a single
 * character. A `{...}` argument becomes `inner`.
 */
export function parseLatex(bibtex: string, i: number): [Latex, number] {
  if (i >= bibtex.length) fail("expected a command after \\", i);

  let command = "";
  if (/[a-zA-Z]/.test(bibtex[i])) {
    while (i < bibtex.length && /[a-zA-Z]/.test(bibtex[i])) {
      command += bibtex[i];
      i++;
    }
    while (i < bibtex.length && /\s/.test(bibtex[i])) i++;
  } else {
    command = bibtex[i];
    i++;
  }

  if (bibtex[i] === "{") {
    const [inner, iInnerEnd] = parseInnerLatex(bibtex, i + 1, "}");
    return [{ command, inner }, iInnerEnd];
  }
  return [{ command }, i];
}

export function parseValue(bibtex: string, i: number): [Text, number] {
  const vals: Text = [];
  while (true) {
    i = skipWhitespace(bibtex, i);
    const char = bibtex[i];
    if (char == "{" || char == '"') {
      const [val, iEnd] = parseInnerLatex(bibtex, i + 1, char == "{" ? "}" : '"');
      vals.push(...val);
      i = iEnd;
    } else {
      const [macro, iEnd] = parseToken(bibtex, i);
      if (macro === "") fail(`expected a value, found ${at(bibtex, i)}`, i);
      vals.push({ macro });
      i = iEnd;
    }

    i = skipWhitespace(bibtex, i);
    if (bibtex[i] == "#") {
      i++;
      continue;
    }
    if (["}", ")", ","].includes(bibtex[i])) return [vals, i];
    fail(`unexpected token ${at(bibtex, i)}`, i);
  }
}

/** Index just past the newline that ends a `%` comment, with `i` inside it. */
export function parseComment(bibtex: string, i: number): number {
  while (i < bibtex.length && bibtex[i] !== "\n") i++;
  return i < bibtex.length ? i + 1 : i;
}

/**
 * Index of the next `@` that actually starts a block, or -1. An `@` inside a
 * `%` comment does not count.
 */
export function findNextBlock(bibtex: string, i: number): number {
  while (i < bibtex.length) {
    if (bibtex[i] === "%") {
      i = parseComment(bibtex, i + 1);
      continue;
    }
    if (bibtex[i] === "@") return i;
    i++;
  }
  return -1;
}

export interface Entries {
  type: string;
  key: string;
  fields: Record<string, Text>;
}
export interface MacroDef {
  macro: string;
  value: Text;
}
export type Block =
  | { kind: "entry"; entry: Entries }
  | { kind: "macro"; macro: MacroDef }
  | { kind: "ignored" };

/**
 * A `name = value` pair. Field and macro names are case-insensitive in BibTeX,
 * so the name comes back folded and `Title` cannot shadow `title`.
 */
export function parseField(bibtex: string, i: number): [string, Text, number] {
  i = skipWhitespace(bibtex, i);
  const [variable, iToken] = parseToken(bibtex, i);
  if (variable === "") fail(`expected a field name, found ${at(bibtex, i)}`, i);
  i = expect(bibtex, iToken, "=");
  const [value, iEnd] = parseValue(bibtex, i);
  return [variable.toLowerCase(), value, iEnd];
}

//at meaning @, so parse @string
export function parseAtString(bibtex: string, i: number, close = "}"): [Block, number] {
  const [macro, value, iEnd] = parseField(bibtex, i);
  i = expect(bibtex, iEnd, close);
  return [{ kind: "macro", macro: { macro, value } }, i];
}

/**
 * Skips a body we do not interpret — `@comment`, `@preamble` — ending just
 * past its closing delimiter. Braces nest, and a backslash hides whatever
 * follows it.
 */
function skipBlockBody(bibtex: string, i: number, close: string): number {
  let depth = 0;
  while (i < bibtex.length) {
    const char = bibtex[i];
    if (char === "\\") {
      i += 2;
      continue;
    }
    if (char === "{") {
      depth++;
      i++;
      continue;
    }
    if (char === "}") {
      if (depth === 0) {
        if (close === "}") return i + 1;
        fail("unexpected '}'", i);
      }
      depth--;
      i++;
      continue;
    }
    if (char === close && depth === 0) return i + 1;
    i++;
  }
  fail(`expected ${close}`, i);
}

export function parseBlockWithId(
  bibtex: string,
  i: number,
  type: string,
  close = "}",
): [Block, number] {
  i = skipWhitespace(bibtex, i);
  const [key, iKey] = parseToken(bibtex, i);
  if (key === "") fail(`expected an entry key, found ${at(bibtex, i)}`, i);
  i = skipWhitespace(bibtex, iKey);

  const fields: Record<string, Text> = {};
  const entry = (iEnd: number): [Block, number] => [
    { kind: "entry", entry: { type, key, fields } },
    iEnd,
  ];

  if (bibtex[i] == close) return entry(i + 1);
  i = expect(bibtex, i, ",");

  while (i < bibtex.length) {
    i = skipWhitespace(bibtex, i);
    // A comma after the last field is allowed, so the closer can turn up here.
    if (bibtex[i] == close) return entry(i + 1);

    const [variable, value, iEnd] = parseField(bibtex, i);
    fields[variable] = value;
    i = skipWhitespace(bibtex, iEnd);
    if (bibtex[i] == ",") {
      i++;
      continue;
    }
    if (bibtex[i] == close) return entry(i + 1);
    fail(`expected , or ${close}, found ${at(bibtex, i)}`, i);
  }
  fail(`Could not find end of block`, i);
}

/** A whole block, with `i` just past its `@`. Braces or parens may delimit it. */
export function parseBlock(bibtex: string, i: number): [Block, number] {
  i = skipWhitespace(bibtex, i);
  const [cmd, iCmd] = parseToken(bibtex, i);
  if (cmd === "") fail(`expected a block type, found ${at(bibtex, i)}`, i);
  i = skipWhitespace(bibtex, iCmd);

  const open = bibtex[i];
  if (open !== "{" && open !== "(") fail(`expected { or (, found ${at(bibtex, i)}`, i);
  const close = open === "{" ? "}" : ")";
  i = skipWhitespace(bibtex, i + 1);

  switch (cmd.toLowerCase()) {
    case "string":
      return parseAtString(bibtex, i, close);
    // Neither holds a bibliography entry, so the body needs no interpreting.
    case "comment":
    case "preamble":
      return [{ kind: "ignored" }, skipBlockBody(bibtex, i, close)];
    default:
      return parseBlockWithId(bibtex, i, cmd, close);
  }
}
