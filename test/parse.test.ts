import { test } from "node:test";
import assert from "assert";

import {
  BibTexParseError,
  expect,
  findNextBlock,
  parseAtString,
  parseBlock,
  parseBlockWithId,
  parseComment,
  parseField,
  parseInnerLatex,
  parseLatex,
  parseToken,
  parseValue,
  skipWhitespace,
} from "../src/parse.ts";

/** Asserts the call throws a parse error pointing at `position`. */
const throwsAt = (fn: () => unknown, position: number) =>
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof BibTexParseError, `expected a BibTexParseError, got ${error}`);
    assert.equal(error.position, position);
    return true;
  });

test("skipWhitespace", async (t) => {
  await t.test("stays put when there is nothing to skip", () => {
    assert.equal(skipWhitespace("abc", 0), 0);
  });

  await t.test("skips spaces, tabs and newlines", () => {
    assert.equal(skipWhitespace(" \t\n x", 0), 4);
  });

  await t.test("skips a comment and the newline that ends it", () => {
    assert.equal(skipWhitespace("% hi\nx", 0), 5);
  });

  await t.test("skips several comment lines in a row", () => {
    assert.equal(skipWhitespace("%a\n%b\nx", 0), 6);
  });

  await t.test("starts from the given index", () => {
    assert.equal(skipWhitespace("a%b", 1), 3);
  });

  await t.test("returns the length when only whitespace is left", () => {
    assert.equal(skipWhitespace("   ", 0), 3);
  });

  await t.test("returns the length for a comment with no trailing newline", () => {
    assert.equal(skipWhitespace("% no newline", 0), 12);
  });
});

test("expect", async (t) => {
  await t.test("consumes the character and the whitespace after it", () => {
    assert.equal(expect("= x", 0, "="), 2);
  });

  await t.test("skips whitespace before the character", () => {
    assert.equal(expect("  ,x", 0, ","), 3);
  });

  await t.test("skips a comment before the character", () => {
    assert.equal(expect("% c\n= y", 0, "="), 6);
  });

  await t.test("returns the length when the character ends the source", () => {
    assert.equal(expect("} ", 0, "}"), 2);
  });

  await t.test("throws on the wrong character, at that character", () => {
    throwsAt(() => expect("  x", 0, "="), 2);
  });

  await t.test("throws at end of input", () => {
    throwsAt(() => expect("", 0, "="), 0);
  });
});

test("parseToken", async (t) => {
  await t.test("reads a plain name", () => {
    assert.deepEqual(parseToken("title = {}", 0), ["title", 5]);
  });

  await t.test("skips leading whitespace", () => {
    assert.deepEqual(parseToken("  key,", 0), ["key", 5]);
  });

  await t.test("skips a leading comment", () => {
    assert.deepEqual(parseToken("% c\nname", 0), ["name", 8]);
  });

  await t.test("keeps digits and punctuation used in citation keys", () => {
    assert.deepEqual(parseToken("von-neumann:1945,", 0), ["von-neumann:1945", 16]);
  });

  await t.test("reads a bare number", () => {
    assert.deepEqual(parseToken("2020}", 0), ["2020", 4]);
  });

  await t.test("stops at a quote", () => {
    assert.deepEqual(parseToken('a"b', 0), ["a", 1]);
  });

  await t.test("stops at an equals sign", () => {
    assert.deepEqual(parseToken("a=b", 0), ["a", 1]);
  });

  await t.test("returns nothing when a delimiter comes first", () => {
    assert.deepEqual(parseToken(",", 0), ["", 0]);
  });

  await t.test("returns nothing at end of input", () => {
    assert.deepEqual(parseToken("", 0), ["", 0]);
  });
});

test("parseInnerLatex", async (t) => {
  await t.test("reads plain text up to a closing brace", () => {
    assert.deepEqual(parseInnerLatex("{abc}", 1, "}"), [["abc"], 5]);
  });

  await t.test("reads plain text up to a closing quote", () => {
    assert.deepEqual(parseInnerLatex('"abc"', 1, '"'), [["abc"], 5]);
  });

  await t.test("an empty value yields no tokens", () => {
    assert.deepEqual(parseInnerLatex("{}", 1, "}"), [[], 2]);
  });

  await t.test("keeps the text on both sides of a command", () => {
    assert.deepEqual(parseInnerLatex("{a\\&b}", 1, "}"), [["a", { command: "&" }, "b"], 6]);
  });

  await t.test("a command with an argument keeps its inner text", () => {
    assert.deepEqual(parseInnerLatex("{\\H{o}s}", 1, "}"), [
      [{ command: "H", inner: ["o"] }, "s"],
      8,
    ]);
  });

  await t.test("a nested brace group becomes its own token", () => {
    assert.deepEqual(parseInnerLatex("{a {b} c}", 1, "}"), [["a ", { inner: ["b"] }, " c"], 9]);
  });

  await t.test("braces nest inside a quoted value", () => {
    assert.deepEqual(parseInnerLatex('"a {b} c"', 1, '"'), [["a ", { inner: ["b"] }, " c"], 9]);
  });

  await t.test("groups nest arbitrarily deep", () => {
    assert.deepEqual(parseInnerLatex("{{{x}}}", 1, "}"), [[{ inner: [{ inner: ["x"] }] }], 7]);
  });

  await t.test("keeps whitespace inside a value", () => {
    assert.deepEqual(parseInnerLatex('" a  b "', 1, '"'), [[" a  b "], 8]);
  });

  await t.test("throws on a stray closing brace in a quoted value", () => {
    throwsAt(() => parseInnerLatex('"a}b"', 1, '"'), 2);
  });

  await t.test("throws when the delimiter never arrives", () => {
    throwsAt(() => parseInnerLatex("{abc", 1, "}"), 4);
  });
});

test("parseLatex", async (t) => {
  await t.test("reads a command name", () => {
    assert.deepEqual(parseLatex("\\alpha,", 1), [{ command: "alpha" }, 6]);
  });

  await t.test("swallows the whitespace that ends a command name", () => {
    assert.deepEqual(parseLatex("\\LaTeX  x", 1), [{ command: "LaTeX" }, 8]);
  });

  await t.test("swallows a newline after a command name", () => {
    assert.deepEqual(parseLatex("\\LaTeX\n x", 1), [{ command: "LaTeX" }, 8]);
  });

  await t.test("stops at a brace and takes the argument", () => {
    assert.deepEqual(parseLatex("\\emph{x}y", 1), [{ command: "emph", inner: ["x"] }, 8]);
  });

  await t.test("takes the argument after a space", () => {
    assert.deepEqual(parseLatex("\\emph {x}", 1), [{ command: "emph", inner: ["x"] }, 9]);
  });

  await t.test("a control symbol is one character", () => {
    assert.deepEqual(parseLatex("\\&more", 1), [{ command: "&" }, 2]);
  });

  await t.test("an accent leaves the letter it applies to as text", () => {
    assert.deepEqual(parseLatex("\\'e", 1), [{ command: "'" }, 2]);
  });

  await t.test("an accent can take a braced argument", () => {
    assert.deepEqual(parseLatex("\\'{e}", 1), [{ command: "'", inner: ["e"] }, 5]);
  });

  await t.test("an escaped backslash does not run on", () => {
    assert.deepEqual(parseLatex("\\\\next", 1), [{ command: "\\" }, 2]);
  });

  await t.test("throws on a trailing backslash", () => {
    throwsAt(() => parseLatex("\\", 1), 1);
  });
});

test("parseValue", async (t) => {
  await t.test("reads a braced value and stops on the comma", () => {
    assert.deepEqual(parseValue("{T},", 0), [["T"], 3]);
  });

  await t.test("reads a quoted value and stops on the brace", () => {
    assert.deepEqual(parseValue('"T"}', 0), [["T"], 3]);
  });

  await t.test("a bare name is a macro reference", () => {
    assert.deepEqual(parseValue("nat,", 0), [[{ macro: "nat" }], 3]);
  });

  await t.test("a bare number is read as a token", () => {
    assert.deepEqual(parseValue("2020}", 0), [[{ macro: "2020" }], 4]);
  });

  await t.test("an empty value yields no tokens", () => {
    assert.deepEqual(parseValue("{},", 0), [[], 2]);
  });

  await t.test("# joins a macro and a literal", () => {
    assert.deepEqual(parseValue('nat # " P",', 0), [[{ macro: "nat" }, " P"], 10]);
  });

  await t.test("# joins two braced parts", () => {
    assert.deepEqual(parseValue("{a} # {b},", 0), [["a", "b"], 9]);
  });

  await t.test("# chains more than twice", () => {
    assert.deepEqual(parseValue("{a} # {b} # {c}}", 0), [["a", "b", "c"], 15]);
  });

  await t.test("skips a comment between the parts", () => {
    assert.deepEqual(parseValue("{a} % note\n # {b},", 0), [["a", "b"], 17]);
  });

  await t.test("throws when something follows the value", () => {
    throwsAt(() => parseValue("{T} x,", 0), 4);
  });

  await t.test("throws when there is no value at all", () => {
    throwsAt(() => parseValue("#,", 0), 0);
  });

  await t.test("throws at end of input", () => {
    throwsAt(() => parseValue("", 0), 0);
  });
});

test("parseComment", async (t) => {
  await t.test("returns the index after the newline", () => {
    assert.equal(parseComment("% x\ny", 1), 4);
  });

  await t.test("returns the length when the comment ends the source", () => {
    assert.equal(parseComment("% x", 1), 3);
  });

  await t.test("an empty comment line advances one line", () => {
    assert.equal(parseComment("%\n@a", 1), 2);
  });
});

test("findNextBlock", async (t) => {
  await t.test("finds an @ after other text", () => {
    assert.equal(findNextBlock("x @article{", 0), 2);
  });

  await t.test("finds an @ at the very start", () => {
    assert.equal(findNextBlock("@a", 0), 0);
  });

  await t.test("starts from the given index", () => {
    assert.equal(findNextBlock("@a @b", 1), 3);
  });

  await t.test("an @ inside a comment does not count", () => {
    assert.equal(findNextBlock("% see @foo\n@article{", 0), 11);
  });

  await t.test("an @ inside the second of two comment lines does not count", () => {
    assert.equal(findNextBlock("% a\n% see @foo\n@x", 0), 15);
  });

  await t.test("returns -1 when there is no block", () => {
    assert.equal(findNextBlock("no blocks", 0), -1);
  });

  await t.test("returns -1 when only a comment is left", () => {
    assert.equal(findNextBlock("% @a", 0), -1);
  });
});

test("parseField", async (t) => {
  await t.test("reads a name and its value", () => {
    assert.deepEqual(parseField("title = {T},", 0), ["title", ["T"], 11]);
  });

  await t.test("tolerates no whitespace at all", () => {
    assert.deepEqual(parseField("title={T}}", 0), ["title", ["T"], 9]);
  });

  await t.test("tolerates a comment between the name and the value", () => {
    assert.deepEqual(parseField("title = % note\n {T},", 0), ["title", ["T"], 19]);
  });

  await t.test("a bare value stays a macro reference", () => {
    assert.deepEqual(parseField("year=2020,", 0), ["year", [{ macro: "2020" }], 9]);
  });

  await t.test("throws when the equals sign is missing", () => {
    throwsAt(() => parseField("title {T}", 0), 6);
  });

  await t.test("throws when the name is missing", () => {
    throwsAt(() => parseField("= {T},", 0), 0);
  });
});

test("parseAtString", async (t) => {
  const after = (source: string) => source.indexOf("{") + 1;

  await t.test("reads a macro definition", () => {
    const src = '@string{nat = "Nature"}';
    assert.deepEqual(parseAtString(src, after(src)), [
      { kind: "macro", macro: "nat", value: ["Nature"] },
      23,
    ]);
  });

  await t.test("a braced definition works the same", () => {
    const src = "@string{nat={Nature}}";
    assert.deepEqual(parseAtString(src, after(src))[0], {
      kind: "macro",
      macro: "nat",
      value: ["Nature"],
    });
  });

  await t.test("a definition may reference another macro", () => {
    const src = '@string{full = nat # " Physics"}';
    assert.deepEqual(parseAtString(src, after(src))[0], {
      kind: "macro",
      macro: "full",
      value: [{ macro: "nat" }, " Physics"],
    });
  });

  await t.test("throws when the closing brace is missing", () => {
    const src = '@string{nat = "Nature"';
    throwsAt(() => parseAtString(src, after(src)), 22);
  });
});

test("parseBlockWithId", async (t) => {
  const after = (source: string) => source.indexOf("{") + 1;

  await t.test("reads a key and one field", () => {
    const src = "@article{a, title={T}}";
    assert.deepEqual(parseBlockWithId(src, after(src), "article"), [
      { kind: "entry", entry: { type: "article", key: "a", fields: { title: ["T"] } } },
      22,
    ]);
  });

  await t.test("reads several fields", () => {
    const src = "@article{a,title={T},year=2020,journal=nat}";
    const [block] = parseBlockWithId(src, after(src), "article");
    assert.deepEqual(block, {
      kind: "entry",
      entry: {
        type: "article",
        key: "a",
        fields: { title: ["T"], year: [{ macro: "2020" }], journal: [{ macro: "nat" }] },
      },
    });
  });

  await t.test("accepts an entry with no fields", () => {
    const src = "@misc{k}";
    assert.deepEqual(parseBlockWithId(src, after(src), "misc"), [
      { kind: "entry", entry: { type: "misc", key: "k", fields: {} } },
      8,
    ]);
  });

  await t.test("accepts a trailing comma", () => {
    const src = "@misc{k,a={1},}";
    assert.deepEqual(parseBlockWithId(src, after(src), "misc"), [
      { kind: "entry", entry: { type: "misc", key: "k", fields: { a: ["1"] } } },
      15,
    ]);
  });

  await t.test("accepts newlines between fields", () => {
    const src = "@misc{k,\n  a = {1},\n  b = {2}\n}";
    const [block] = parseBlockWithId(src, after(src), "misc");
    assert.deepEqual(block, {
      kind: "entry",
      entry: { type: "misc", key: "k", fields: { a: ["1"], b: ["2"] } },
    });
  });

  await t.test("keeps a punctuated citation key", () => {
    const src = "@book{von-neumann:1945,a={1}}";
    const [block] = parseBlockWithId(src, after(src), "book");
    assert.equal(block.kind === "entry" && block.entry.key, "von-neumann:1945");
  });

  await t.test("stops at the closing brace, leaving the rest alone", () => {
    const src = "@misc{k,a={1}} trailing";
    assert.equal(parseBlockWithId(src, after(src), "misc")[1], 14);
  });

  await t.test("throws when the key is missing", () => {
    const src = "@misc{,a={1}}";
    throwsAt(() => parseBlockWithId(src, after(src), "misc"), 6);
  });

  await t.test("throws when the entry is never closed", () => {
    const src = "@misc{k,a={1}";
    throwsAt(() => parseBlockWithId(src, after(src), "misc"), 13);
  });
});

test("parseBlock", async (t) => {
  await t.test("reads an entry", () => {
    assert.deepEqual(parseBlock("@article{a,title={T}}", 1), [
      { kind: "entry", entry: { type: "article", key: "a", fields: { title: ["T"] } } },
      21,
    ]);
  });

  await t.test("keeps the entry type as written", () => {
    const [block] = parseBlock("@InProceedings{a,title={T}}", 1);
    assert.equal(block.kind === "entry" && block.entry.type, "InProceedings");
  });

  await t.test("reads a @string block", () => {
    const [block] = parseBlock('@string{n="N"}', 1);
    assert.deepEqual(block, { kind: "macro", macro: "n", value: ["N"] });
  });

  await t.test("recognises @string whatever its case", () => {
    const [block] = parseBlock('@STRING{n="N"}', 1);
    assert.equal(block.kind, "macro");
  });

  await t.test("tolerates whitespace around the type", () => {
    const [block] = parseBlock("@ article {a,title={T}}", 1);
    assert.equal(block.kind, "entry");
  });

  await t.test("throws when the type is missing", () => {
    throwsAt(() => parseBlock("@{}", 1), 1);
  });

  await t.test("throws when the opening brace is missing", () => {
    throwsAt(() => parseBlock("@article a,", 1), 9);
  });
});
