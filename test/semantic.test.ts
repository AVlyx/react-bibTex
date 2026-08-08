import { test } from "node:test";
import assert from "assert";

import { BibTexNoEntryError, parseValue } from "../src/parse.ts";
import type { MacroDef, Text } from "../src/parse.ts";
import {
  extractBlocks,
  groupToString,
  latexToString,
  latexToText,
  macroToString,
  parseBibTex,
  parseBibTexList,
  parseBlocks as blocks,
  textToString,
} from "../src/semantic.ts";

/** Lexes a field value, so a test can be written as the BibTeX you would type. */
const value = (source: string): Text => parseValue(`{${source}},`, 0)[0];

const defs = (...pairs: [string, Text][]): MacroDef[] =>
  pairs.map(([macro, value]) => ({ macro, value }));

test("extractBlocks", async (t) => {
  await t.test("collects an entry", () => {
    const { entries, macros } = extractBlocks(blocks("@article{a,title={T}}"));
    assert.equal(macros.length, 0);
    assert.deepEqual(entries, [{ type: "article", key: "a", fields: { title: ["T"] } }]);
  });

  await t.test("collects a macro definition", () => {
    const { entries, macros } = extractBlocks(blocks('@string{n="N"}'));
    assert.equal(entries.length, 0);
    assert.deepEqual(macros, [{ macro: "n", value: ["N"] }]);
  });

  await t.test("drops the blocks that carry nothing", () => {
    const src = '@comment{x}@preamble{"p"}@article{a,title={T}}';
    const { entries, macros } = extractBlocks(blocks(src));
    assert.equal(entries.length, 1);
    assert.equal(macros.length, 0);
  });

  await t.test("keeps source order", () => {
    const src = '@string{a="1"}@article{x,t={X}}@string{b="2"}@article{y,t={Y}}';
    const { entries, macros } = extractBlocks(blocks(src));
    assert.deepEqual(
      macros.map((m) => m.macro),
      ["a", "b"],
    );
    assert.deepEqual(
      entries.map((e) => e.key),
      ["x", "y"],
    );
  });

  await t.test("an empty document yields two empty lists", () => {
    assert.deepEqual(extractBlocks([]), { entries: [], macros: [] });
  });
});

test("macroToString", async (t) => {
  await t.test("expands a definition", () => {
    assert.equal(macroToString({ macro: "nat" }, defs(["nat", ["Nature"]])), "Nature");
  });

  await t.test("a reference ignores case", () => {
    assert.equal(macroToString({ macro: "NaT" }, defs(["nat", ["Nature"]])), "Nature");
  });

  await t.test("months are built in", () => {
    assert.equal(macroToString({ macro: "jan" }, []), "January");
  });

  await t.test("a definition overrides a built-in", () => {
    assert.equal(macroToString({ macro: "jan" }, defs(["jan", ["Januar"]])), "Januar");
  });

  await t.test("a bare number stays as written", () => {
    assert.equal(macroToString({ macro: "2020" }, []), "2020");
  });

  await t.test("an undefined name keeps the case it was written in", () => {
    assert.equal(macroToString({ macro: "Whatever" }, []), "Whatever");
  });

  await t.test("the last definition of a name wins", () => {
    const table = defs(["n", ["A"]], ["n", ["B"]]);
    assert.equal(macroToString({ macro: "n" }, table), "B");
  });

  await t.test("a definition may use one that came before it", () => {
    const table = defs(["a", ["X"]], ["b", [{ macro: "a" }, " Y"]]);
    assert.equal(macroToString({ macro: "b" }, table), "X Y");
  });

  await t.test("a redefinition may build on the value it replaces", () => {
    const table = defs(["n", ["A"]], ["n", [{ macro: "n" }, "B"]]);
    assert.equal(macroToString({ macro: "n" }, table), "AB");
  });

  await t.test("a definition cannot see one that comes after it, so cycles resolve", () => {
    const table = defs(["a", [{ macro: "b" }]], ["b", [{ macro: "a" }]]);
    assert.equal(macroToString({ macro: "b" }, table), "b");
  });

  await t.test("a definition is rendered, not just concatenated", () => {
    assert.equal(macroToString({ macro: "n" }, defs(["n", [{ command: "ss" }]])), "ß");
  });
});

test("groupToString", async (t) => {
  await t.test("stands in for its content", () => {
    assert.equal(groupToString({ inner: ["DNA"] }, []), "DNA");
  });

  await t.test("an empty group is empty", () => {
    assert.equal(groupToString({ inner: [] }, []), "");
  });

  await t.test("groups nest", () => {
    assert.equal(groupToString({ inner: [{ inner: ["x"] }] }, []), "x");
  });

  await t.test("a command inside is rendered", () => {
    assert.equal(groupToString({ inner: [{ command: "&" }] }, []), "&");
  });

  await t.test("a macro inside is expanded", () => {
    assert.equal(groupToString({ inner: [{ macro: "jan" }] }, []), "January");
  });
});

test("latexToString", async (t) => {
  await t.test("an accent composes with its argument", () => {
    assert.equal(latexToString({ command: "'", inner: ["e"] }, []), "é");
  });

  await t.test("a letter accent works the same", () => {
    assert.equal(latexToString({ command: "H", inner: ["o"] }, []), "ő");
  });

  await t.test("a ligature needs no argument", () => {
    assert.equal(latexToString({ command: "ss" }, []), "ß");
  });

  await t.test("a ligature written with empty braces is the same", () => {
    assert.equal(latexToString({ command: "o", inner: [] }, []), "ø");
  });

  await t.test("a symbol stands for its character", () => {
    assert.equal(latexToString({ command: "&" }, []), "&");
  });

  await t.test("a control space is a space", () => {
    assert.equal(latexToString({ command: " " }, []), " ");
  });

  await t.test("textbackslash is a backslash", () => {
    assert.equal(latexToString({ command: "textbackslash" }, []), "\\");
  });

  await t.test("a wrapper keeps its argument", () => {
    assert.equal(latexToString({ command: "emph", inner: ["important"] }, []), "important");
  });

  await t.test("nested wrappers need no second pass", () => {
    const token = { command: "textbf", inner: [{ command: "emph", inner: ["x"] }] };
    assert.equal(latexToString(token, []), "x");
  });

  await t.test("an unknown command is dropped and its argument kept", () => {
    assert.equal(latexToString({ command: "textcolor", inner: ["kept"] }, []), "kept");
  });

  await t.test("an unknown command with no argument leaves nothing", () => {
    assert.equal(latexToString({ command: "relax" }, []), "");
  });

  await t.test("a macro inside an argument is expanded", () => {
    const table = defs(["nat", ["Nature"]]);
    assert.equal(latexToString({ command: "emph", inner: [{ macro: "nat" }] }, table), "Nature");
  });
});

test("textToString", async (t) => {
  await t.test("plain text passes through", () => {
    assert.equal(textToString(["Nothing special"], []), "Nothing special");
  });

  await t.test("whitespace is left alone", () => {
    assert.equal(textToString(["  a   b  "], []), "  a   b  ");
  });

  await t.test("dashes become en and em dashes", () => {
    assert.equal(textToString(["10--20 and 30---40"], []), "10–20 and 30—40");
  });

  await t.test("TeX quotes become curly quotes", () => {
    assert.equal(textToString(["``quoted''"], []), "“quoted”");
  });

  await t.test("a tie becomes a space", () => {
    assert.equal(textToString(["Fig.~3"], []), "Fig. 3");
  });

  await t.test("math delimiters are dropped", () => {
    assert.equal(textToString(["$n$-body"], []), "n-body");
  });

  await t.test("an escaped character is not treated as markup", () => {
    assert.equal(textToString([{ command: "$" }, "x"], []), "$x");
  });

  await t.test("a bare accent takes the letter that follows it", () => {
    assert.equal(textToString([{ command: "'" }, "ecole"], []), "école");
  });

  await t.test("a bare accent takes only one letter", () => {
    assert.equal(textToString([{ command: "'" }, "ee"], []), "ée");
  });

  await t.test("a letter accent takes the letter that follows it", () => {
    assert.equal(textToString([{ command: "v" }, "Capek"], []), "Čapek");
  });

  await t.test("an accent with an argument does not eat what follows", () => {
    assert.equal(textToString([{ command: "'", inner: ["e"] }, "cole"], []), "école");
  });

  await t.test("the caller's tokens survive an accent", () => {
    const tokens: Text = [{ command: "'" }, "ecole"];
    textToString(tokens, []);
    assert.deepEqual(tokens, [{ command: "'" }, "ecole"]);
  });

  await t.test("every kind of token in one run", () => {
    const table = defs(["nat", ["Nature"]]);
    const tokens: Text = ["In ", { inner: ["DNA"] }, ", ", { macro: "nat" }, { command: "&" }];
    assert.equal(textToString(tokens, table), "In DNA, Nature&");
  });
});

test("latexToText", async (t) => {
  await t.test("collapses runs of whitespace", () => {
    assert.equal(latexToText(["a   b"]), "a b");
  });

  await t.test("collapses a newline inside a value", () => {
    assert.equal(latexToText(["a\n  b"]), "a b");
  });

  await t.test("trims the ends", () => {
    assert.equal(latexToText(["  padded  "]), "padded");
  });

  await t.test("keeps the space between two fragments", () => {
    assert.equal(latexToText(["An ", { command: "emph", inner: ["odd"] }, " one"]), "An odd one");
  });

  await t.test("composes accents into single code points", () => {
    assert.equal(latexToText([{ command: "'", inner: ["e"] }]).length, 1);
  });

  await t.test("takes no macro table by default", () => {
    assert.equal(latexToText([{ macro: "jan" }]), "January");
  });

  await t.test("expands against the table it is given", () => {
    assert.equal(latexToText([{ macro: "nat" }], defs(["nat", ["Nature"]])), "Nature");
  });
});

test("latexToText over lexed values", async (t) => {
  const cases: [string, string][] = [
    ["A {Nested} Title", "A Nested Title"],
    ["Caf{\\'{e}}", "Café"],
    ["Caf\\'e", "Café"],
    ['G{\\"o}del', "Gödel"],
    ["Erd{\\H{o}}s", "Erdős"],
    ["Fran\\c{c}ois", "François"],
    ["\\v{C}apek", "Čapek"],
    ["Pe\\~{n}a", "Peña"],
    ["\\'{\\i}sla", "ísla"],
    ["\\o{}rsted", "ørsted"],
    ["Wei\\ss{}", "Weiß"],
    ["Encyclop\\ae dia", "Encyclopædia"],
    ["Johnson \\& Johnson", "Johnson & Johnson"],
    ["50\\% faster", "50% faster"],
    ["Set \\{a\\}", "Set {a}"],
    ["10--20", "10–20"],
    ["wait---no", "wait—no"],
    ["``quoted''", "“quoted”"],
    ["An \\emph{important} result", "An important result"],
    ["\\textbf{\\emph{x}}", "x"],
    ["$n$-body problem", "n-body problem"],
    ["Fig.~3", "Fig. 3"],
    ["\\relax plain", "plain"],
    ["Nothing special here", "Nothing special here"],
    ["pages 10--20 \\& 30", "pages 10–20 & 30"],
  ];

  for (const [source, expected] of cases) {
    await t.test(source, () => assert.equal(latexToText(value(source)), expected));
  }
});

test("a whole document", async (t) => {
  /** One field of the first entry, resolved the way the driver will resolve it. */
  const field = (source: string, name: string): string => {
    const { entries, macros } = extractBlocks(blocks(source));
    return latexToText(entries[0].fields[name], macros);
  };

  await t.test("a macro defined earlier reaches a later entry", () => {
    const src = '@string{nat="Nature"}\n@article{a,journal=nat}';
    assert.equal(field(src, "journal"), "Nature");
  });

  await t.test("# joins a macro and a literal, keeping the space", () => {
    const src = '@string{nat="Nature"}\n@article{a,journal= nat # " Physics"}';
    assert.equal(field(src, "journal"), "Nature Physics");
  });

  await t.test("a macro survives into later entries", () => {
    const src = '@string{n="N"}\n@article{a,journal=n}\n@article{b,journal=n}';
    const { entries, macros } = extractBlocks(blocks(src));
    assert.equal(latexToText(entries[1].fields.journal, macros), "N");
  });

  await t.test("@comment and @preamble do not disturb the entries", () => {
    const src = '@comment{jabref-meta: x}@preamble{"\\newcommand{\\x}{y}"}@article{a,title={T}}';
    assert.equal(field(src, "title"), "T");
  });

  await t.test("a braced group protects nothing but still reads through", () => {
    assert.equal(field("@article{a,title={On {NP} problems}}", "title"), "On NP problems");
  });

  await t.test("an accented author survives the whole pipeline", () => {
    assert.equal(field("@article{a,author={Erd{\\H{o}}s, P.}}", "author"), "Erdős, P.");
  });

  await t.test("a value split over lines becomes one line", () => {
    assert.equal(field("@article{a,title={A\n   long\n   title}}", "title"), "A long title");
  });

  await t.test("field names differing in case are one field", () => {
    assert.equal(field("@article{a,Title={T}}", "title"), "T");
  });
});

test("parseBlocks", async (t) => {
  await t.test("walks every block in order", () => {
    const found = blocks('@string{n="N"}@article{a,t={T}}@comment{x}');
    assert.deepEqual(
      found.map((b) => b.kind),
      ["macro", "entry", "ignored"],
    );
  });

  await t.test("text between blocks is ignored", () => {
    assert.equal(blocks("stray words @misc{k} more words @misc{j}").length, 2);
  });

  await t.test("a document with no block yields nothing", () => {
    assert.deepEqual(blocks("no blocks here"), []);
  });

  await t.test("a malformed block throws", () => {
    assert.throws(() => blocks("@article{a, title={unterminated"), { name: "BibTexParseError" });
  });
});

test("parseBibTexList", async (t) => {
  await t.test("decodes every field to display text", () => {
    const [entry] = parseBibTexList("@article{a,title={Erd{\\H{o}}s and {NP}}}");
    assert.deepEqual(entry, { type: "article", key: "a", fields: { title: "Erdős and NP" } });
  });

  await t.test("returns the entries in source order", () => {
    const list = parseBibTexList("@misc{a,t={1}}@misc{b,t={2}}");
    assert.deepEqual(
      list.map((e) => e.key),
      ["a", "b"],
    );
  });

  await t.test("a file of only macros yields no entries", () => {
    assert.deepEqual(parseBibTexList('@string{nat="Nature"}'), []);
  });

  await t.test("a macro reaches the entries after it", () => {
    const src = '@string{n="N"}@article{a,journal=n}@article{b,journal=n}';
    const list = parseBibTexList(src);
    assert.deepEqual(
      list.map((e) => e.fields.journal),
      ["N", "N"],
    );
  });

  await t.test("a macro defined after an entry is not in scope for it", () => {
    const src = '@article{a,journal=n}@string{n="N"}@article{b,journal=n}';
    const list = parseBibTexList(src);
    assert.deepEqual(
      list.map((e) => e.fields.journal),
      ["n", "N"],
    );
  });

  await t.test("a redefinition only affects the entries after it", () => {
    const src = '@string{n="A"}@misc{x,t=n}@string{n="B"}@misc{y,t=n}';
    const list = parseBibTexList(src);
    assert.deepEqual(
      list.map((e) => e.fields.t),
      ["A", "B"],
    );
  });

  await t.test("a malformed entry throws", () => {
    assert.throws(() => parseBibTexList("@article{a, title={unterminated"), {
      name: "BibTexParseError",
    });
  });
});

test("parseBibTex", async (t) => {
  await t.test("returns the first entry", () => {
    assert.equal(parseBibTex("@misc{a,t={1}}@misc{b,t={2}}").key, "a");
  });

  await t.test("uses a macro defined before it", () => {
    assert.equal(parseBibTex('@string{n="N"}@article{a,journal=n}').fields.journal, "N");
  });

  await t.test("skips the blocks that carry no entry", () => {
    assert.equal(parseBibTex('@comment{x}@preamble{"p"}@misc{a,t={1}}').key, "a");
  });

  await t.test("nothing after the first entry is read", () => {
    assert.equal(parseBibTex("@misc{a,t={1}}@misc{b, t={unterminated").key, "a");
  });

  await t.test("throws when the source holds no entry", () => {
    assert.throws(() => parseBibTex('@string{n="N"}'), { name: "BibTexNoEntryError" });
  });

  await t.test("the no-entry error is a parse error too", () => {
    assert.throws(() => parseBibTex(""), (error: unknown) => {
      assert.ok(error instanceof BibTexNoEntryError);
      return true;
    });
  });
});
