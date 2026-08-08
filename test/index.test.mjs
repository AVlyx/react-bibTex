import { test } from "node:test";
import assert from "node:assert/strict";

import { BibTex, latexToText, parseBibTexList } from "../dist/index.js";

const fields = (src) => parseBibTexList(src).map((entry) => entry.fields);

test("% comments", async (t) => {
  await t.test("a comment line between fields", () => {
    assert.deepEqual(fields("@article{a,\n % comment\n title={T}}"), [{ title: "T" }]);
  });

  await t.test("an @ inside a comment does not start an entry", () => {
    assert.equal(parseBibTexList("% see @foo\n@article{a,title={T}}")[0].type, "article");
  });

  await t.test("a comment between the field name and its value", () => {
    assert.deepEqual(fields("@article{a, title = % note\n {T}}"), [{ title: "T" }]);
  });

  await t.test("a comment after the entry", () => {
    assert.deepEqual(fields("@article{a,title={T}} % done"), [{ title: "T" }]);
  });

  await t.test("% inside a value is literal", () => {
    assert.equal(fields("@article{a,note={50% off}}")[0].note, "50% off");
  });
});

test("@string, @preamble and @comment", async (t) => {
  await t.test("a macro expands where it is used", () => {
    assert.equal(fields('@string{nat = "Nature"}\n@article{a,journal=nat}')[0].journal, "Nature");
  });

  await t.test("macro names ignore case", () => {
    assert.equal(fields('@string{NAT = "Nature"}\n@article{a,journal=nat}')[0].journal, "Nature");
  });

  await t.test("# joins values, keeping significant spaces", () => {
    const src = '@string{nat="Nature"}\n@article{a,journal= nat # " Physics"}';
    assert.equal(fields(src)[0].journal, "Nature Physics");
  });

  await t.test("month abbreviations are built in", () => {
    assert.equal(fields("@article{a,month=jan}")[0].month, "January");
  });

  await t.test("a bare value that is not a macro stays as written", () => {
    assert.equal(fields("@article{a,year=2020}")[0].year, "2020");
  });

  await t.test("a macro survives into later entries", () => {
    const src = '@string{n="N"}\n@article{a,journal=n}\n@article{b,journal=n}';
    assert.equal(fields(src)[1].journal, "N");
  });

  await t.test("@preamble is skipped", () => {
    assert.equal(
      parseBibTexList('@preamble{"\\newcommand{\\x}{y}"}\n@article{a,title={T}}').length,
      1,
    );
  });

  await t.test("@comment is skipped", () => {
    assert.equal(parseBibTexList("@comment{jabref-meta: {x}}\n@article{a,title={T}}").length, 1);
  });

  await t.test("a file of only macros yields no entries", () => {
    assert.deepEqual(parseBibTexList('@string{nat="Nature"}'), []);
  });

  await t.test("a malformed entry still throws", () => {
    assert.throws(() => parseBibTexList("@article{a, title={unterminated"), {
      name: "BibTexParseError",
    });
  });
});

test("latexToText", async (t) => {
  const cases = [
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
    await t.test(source, () => assert.equal(latexToText(source), expected));
  }
});

test("BibTex renders a decoded citation line", () => {
  const src =
    "@article{a, author={Erd{\\H{o}}s, P.}, title={On {NP} problems}," +
    " journal={Nature}, volume={3}, number={2}, year={1959}, doi={10.1000/xyz}}";

  const text = [];
  (function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node === "string" || typeof node === "number") return void text.push(String(node));
    if (node && node.props) walk(node.props.children);
  })(BibTex({ entry: parseBibTexList(src)[0] }));

  assert.equal(
    text.join(""),
    "Erdős, P.. On NP problems. Nature. vol. 3(2). (1959). doi:10.1000/xyz.",
  );
});

test("styleMode", async (t) => {
  const entry = parseBibTexList("@article{a, title={T}, journal={J}}")[0];

  /** Collects the inline style of each slot-bearing element, keyed by its text. */
  const stylesOf = (props) => {
    const found = [];
    (function walk(node) {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || !node.props) return;
      if (node.props.style) found.push(node.props.style);
      walk(node.props.children);
    })(BibTex({ entry, ...props }));
    return found;
  };

  const has = (list, style) => list.some((s) => Object.entries(style).every(([k, v]) => s[k] === v));

  await t.test("defaults apply with no styles prop", () => {
    const styles = stylesOf({});
    assert.ok(has(styles, { fontStyle: "italic" }), "title keeps its italic default");
    assert.ok(has(styles, { fontWeight: 700 }), "journal keeps its bold default");
  });

  await t.test("merge layers the override over the default", () => {
    const styles = stylesOf({ styles: { title: { color: "red" } } });
    assert.ok(
      has(styles, { color: "red", fontStyle: "italic" }),
      "title gains the colour and keeps the default italic",
    );
  });

  await t.test("replace takes the override verbatim", () => {
    const styles = stylesOf({ styles: { title: { color: "red" } }, styleMode: "replace" });
    assert.ok(has(styles, { color: "red" }), "title takes the colour");
    assert.ok(
      !styles.some((s) => s.color === "red" && s.fontStyle === "italic"),
      "title drops the default italic",
    );
  });

  await t.test("replace leaves slots without an override untouched", () => {
    const styles = stylesOf({ styles: { title: { color: "red" } }, styleMode: "replace" });
    assert.ok(has(styles, { fontWeight: 700 }), "journal keeps its bold default");
  });

  await t.test("an empty override strips a slot under replace", () => {
    const styles = stylesOf({ styles: { title: {} }, styleMode: "replace" });
    assert.ok(!has(styles, { fontStyle: "italic" }), "the default italic is gone");
  });

  await t.test("an empty override changes nothing under merge", () => {
    const styles = stylesOf({ styles: { title: {} } });
    assert.ok(has(styles, { fontStyle: "italic" }), "the default italic survives");
  });
});
