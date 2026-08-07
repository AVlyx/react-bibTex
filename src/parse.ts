export interface BibEntry {
  type: string; //does not do anything
  key: string; //does not do anything
  fields: Record<string, string>; //only relevant field
}

/** Abbreviations usable as bare values, defined by `@string` or built in. */
export type BibTexMacros = Record<string, string>;

/** BibTeX predefines these; a `.bib` file may still override them with `@string`. */
const builtinMacros: BibTexMacros = {
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

export class BibTexParseError extends Error {
  constructor(
    message: string,
    public readonly position: number,
  ) {
    super(`${message} (at index ${position})`);
    this.name = "BibTexParseError";
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
 * Index of the next `@` that actually starts a block. Text between blocks is
 * ignored, and `%` comments out the rest of its line — so the `@` in
 * `% see @foo` does not look like an entry.
 */
const findNextBlock = (source: string, from: number): number => {
  let i = Math.max(from, 0);
  while (i < source.length) {
    if (source[i] === "%") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (source[i] === "@") return i;
    i++;
  }
  return -1;
};

type Block =
  | { kind: "entry"; entry: BibEntry }
  | { kind: "macro"; name: string; value: string }
  | { kind: "ignored" };

export function parse(
  bibtex: string,
  iStart: number = 0,
  macros: BibTexMacros = {},
): { bibEntry: BibEntry; iEnd: number; macros: BibTexMacros } {
  let i = iStart;
  const table: BibTexMacros = { ...builtinMacros, ...macros };

  function fail(message: string): never {
    throw new BibTexParseError(message, i);
  }

  const at = () => (i < bibtex.length ? bibtex[i] : "end of input");

  const skipWhitespace = () => {
    while (i < bibtex.length) {
      if (/\s/.test(bibtex[i])) {
        i++;
        continue;
      }
      if (bibtex[i] === "%") {
        while (i < bibtex.length && bibtex[i] !== "\n") i++;
        continue;
      }
      return;
    }
  };

  const parseFromto = (
    failOn: string[],
    from: string[],
    to: (start: string) => string[],
    { depth = false, consume = true, trim = true } = {},
  ): string => {
    let word = "";

    const goDeep = () => {
      word += bibtex[i];
      i++;
      while (true) {
        if (i >= bibtex.length) fail("expected }");
        if (bibtex[i] === "\\") {
          word += bibtex[i] + (bibtex[i + 1] ?? "");
          i += 2;
          continue;
        }
        if (bibtex[i] === "{") {
          goDeep();
          continue;
        }
        word += bibtex[i];
        if (bibtex[i] === "}") {
          i++;
          return;
        }
        i++;
      }
    };

    skipWhitespace();

    let end: string[];
    if (from.length === 0) {
      end = to("");
    } else if (from.includes(bibtex[i])) {
      end = to(bibtex[i]);
      i++;
    } else {
      fail(`expected "${from.join('" or "')}", found "${at()}"`);
    }

    while (true) {
      if (i >= bibtex.length) {
        fail(`unexpected end of input, expected "${end.join('" or "')}"`);
      }
      if (failOn.includes(bibtex[i])) {
        fail(`unexpected token "${at()}"`);
      }
      if (end.includes(bibtex[i])) {
        if (consume) i++;
        return trim ? word.trim() : word;
      }
      if (depth && bibtex[i] === "\\") {
        word += bibtex[i] + (bibtex[i + 1] ?? "");
        i += 2;
        continue;
      }
      if (depth && bibtex[i] === "{") {
        goDeep();
        continue;
      }
      word += bibtex[i];
      i++;
    }
  };

  const parseBibType = () => parseFromto(["}", ",", '"'], ["@"], () => ["{"]);
  const parseName = () => parseFromto(["}", '"', "{"], [], () => [","]);
  const parseVariable = () => parseFromto(["}", '"', "{"], [], () => ["="]);

  const parseBraced = () =>
    parseFromto(
      [],
      ["{", '"'],
      (start: string) => {
        if (start === "{") return ["}"];
        if (start === '"') return ['"'];
        return [];
      },
      // Whitespace inside the delimiters is significant once values are joined
      // with `#`; the assembled value is trimmed instead.
      { depth: true, trim: false },
    );
  const parseBare = () => parseFromto([], [], () => [",", "}", "#"], { consume: false });

  /** One value, before any `#` concatenation. Bare words resolve as macros. */
  const parseValuePart = () => {
    skipWhitespace();
    if (bibtex[i] === "{" || bibtex[i] === '"') return parseBraced();
    const bare = parseBare();
    if (!bare) fail(`expected a value, found "${at()}"`);
    return table[bare.toLowerCase()] ?? bare;
  };

  const parseValue = () => {
    let value = parseValuePart();
    while (true) {
      skipWhitespace();
      if (bibtex[i] !== "#") return value.trim();
      i++;
      value += parseValuePart();
    }
  };

  /** Consumes through the `}` matching the one already opened. */
  const skipBalanced = () => {
    let depth = 1;
    while (i < bibtex.length) {
      if (bibtex[i] === "\\") {
        i += 2;
        continue;
      }
      if (bibtex[i] === "{") depth++;
      else if (bibtex[i] === "}") {
        depth--;
        i++;
        if (depth === 0) return;
        continue;
      }
      i++;
    }
    fail("unterminated block");
  };

  const parseEntry = (type: string): BibEntry => {
    const key = parseName();
    const fields: Record<string, string> = {};

    while (true) {
      skipWhitespace();
      if (bibtex[i] === "}") {
        i++;
        return { type, key, fields };
      }
      if (i >= bibtex.length) fail(`unterminated entry "${key}"`);

      const name = parseVariable().toLowerCase();
      fields[name] = parseValue();

      skipWhitespace();
      if (bibtex[i] === ",") {
        i++;
        continue;
      }
      if (bibtex[i] === "}") {
        i++;
        return { type, key, fields };
      }
      fail(`expected "," or "}" after "${name}", found "${at()}"`);
    }
  };

  const parseStringBlock = (): Block => {
    const name = parseVariable().toLowerCase();
    const value = parseValue();

    skipWhitespace();
    if (bibtex[i] === ",") {
      i++;
      skipWhitespace();
    }
    if (bibtex[i] !== "}") fail(`expected "}" to close @string "${name}", found "${at()}"`);
    i++;

    return { kind: "macro", name, value };
  };

  const parseBlock = (): Block => {
    const type = parseBibType().toLowerCase();
    if (type === "string") return parseStringBlock();
    if (type === "preamble" || type === "comment") {
      skipBalanced();
      return { kind: "ignored" };
    }
    return { kind: "entry", entry: parseEntry(type) };
  };

  // `@string`/`@preamble`/`@comment` are not bibliography entries: absorb them
  // and keep looking for one that is.
  while (true) {
    i = findNextBlock(bibtex, i);
    if (i === -1) {
      i = bibtex.length;
      throw new BibTexNoEntryError("no BibTeX entry found, expected the source to contain an @", i);
    }

    const block = parseBlock();
    if (block.kind === "entry") return { bibEntry: block.entry, iEnd: i, macros: table };
    if (block.kind === "macro") table[block.name] = block.value;
  }
}

export function parseAll(bibtex: string): BibEntry[] {
  const entries: BibEntry[] = [];
  let macros: BibTexMacros = {};

  let i = findNextBlock(bibtex, 0);
  while (i !== -1) {
    // Blocks that are not entries (a trailing `@string`, say) leave nothing to
    // collect, which is not an error. Malformed entries still throw.
    let result;
    try {
      result = parse(bibtex, i, macros);
    } catch (error) {
      if (error instanceof BibTexNoEntryError) break;
      throw error;
    }

    entries.push(result.bibEntry);
    macros = result.macros;
    i = findNextBlock(bibtex, result.iEnd);
  }

  return entries;
}
