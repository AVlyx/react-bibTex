export interface BibEntry {
  type: string; //does not do anything
  key: string; //does not do anything
  fields: Record<string, string>; //only relevant field
}

export class BibTexParseError extends Error {
  constructor(
    message: string,
    public readonly position: number,
  ) {
    super(`${message} (at index ${position})`);
    this.name = "BibTexParseError";
  }
}

export function parse(bibtex: string, iStart: number = 0): { bibEntry: BibEntry; iEnd: number } {
  let i = iStart;

  function fail(message: string): never {
    throw new BibTexParseError(message, i);
  }

  const at = () => (i < bibtex.length ? bibtex[i] : "end of input");

  const skipWhitespace = () => {
    while (i < bibtex.length && /\s/.test(bibtex[i])) i++;
  };

  const parseFromto = (
    failOn: string[],
    from: string[],
    to: (start: string) => string[],
    { depth = false, consume = true } = {},
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
        return word.trim();
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
      { depth: true },
    );
  const parseBare = () => parseFromto([], [], () => [",", "}"], { consume: false });

  const parseValue = () => {
    skipWhitespace();
    if (bibtex[i] === "{" || bibtex[i] === '"') return parseBraced();
    const bare = parseBare();
    if (!bare) fail(`expected a value, found "${at()}"`);
    return bare;
  };

  const parseEntry = (): BibEntry => {
    const type = parseBibType().toLowerCase();
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

  i = bibtex.indexOf("@", i);
  if (i === -1) {
    i = bibtex.length;
    fail("no BibTeX entry found, expected the source to contain an @");
  }
  const bibEntry = parseEntry();
  return { bibEntry, iEnd: i };
}

export function parseAll(bibtex: string): BibEntry[] {
  const entries: BibEntry[] = [];

  let i = bibtex.indexOf("@");
  while (i !== -1) {
    const { bibEntry, iEnd } = parse(bibtex, i);
    entries.push(bibEntry);
    i = bibtex.indexOf("@", iEnd);
  }

  return entries;
}
