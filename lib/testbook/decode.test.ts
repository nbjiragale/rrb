import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeTestbookHtml } from "./decode.ts";

test("strips tags and decodes basic entities", () => {
  const out = decodeTestbookHtml("<p>Speed is 54&nbsp;kmph &amp; rising</p>");
  assert.equal(out, "Speed is 54 kmph & rising");
});

test("unwraps double-encoded math symbols", () => {
  // Testbook ships &amp;radic; meaning &radic; meaning √
  assert.equal(decodeTestbookHtml("&amp;radic;9 = 3"), "√9 = 3");
  assert.equal(decodeTestbookHtml("54 &amp;times; 2"), "54 × 2");
});

test("decodes numeric entities", () => {
  assert.equal(decodeTestbookHtml("don&#39;t"), "don't");
});

test("images degrade to a marker, LaTeX survives", () => {
  const out = decodeTestbookHtml('value <img src="x.png" /> \\(x^2\\)');
  assert.equal(out, "value [image] \\(x^2\\)");
});

test("block tags become newlines, runs collapse", () => {
  const out = decodeTestbookHtml("<p>a</p><p>b</p>");
  assert.equal(out, "a\nb");
});

test("empty / nullish input is safe", () => {
  assert.equal(decodeTestbookHtml(null), "");
  assert.equal(decodeTestbookHtml(undefined), "");
  assert.equal(decodeTestbookHtml(""), "");
});
