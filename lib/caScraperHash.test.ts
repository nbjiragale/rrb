import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contentHash,
  expandSourceUrl,
  getCaSourceUrls,
  isGrounded,
  normaliseCategory,
  normaliseForHash,
} from "./caScraperHash.ts";

test("normaliseForHash lowercases and collapses whitespace", () => {
  assert.equal(normaliseForHash("  Hello   WORLD\n\tfoo  "), "hello world foo");
});

test("contentHash is stable across trivial formatting differences", () => {
  const a = contentHash("ISRO launched Chandrayaan-3 on July 14, 2023.");
  const b = contentHash("  isro launched   Chandrayaan-3 on July 14, 2023.\n");
  assert.equal(a, b);
});

test("contentHash differs for different content", () => {
  const a = contentHash("ISRO launched Chandrayaan-3.");
  const b = contentHash("ISRO launched Aditya-L1.");
  assert.notEqual(a, b);
});

test("getCaSourceUrls handles empty / single / comma-separated / padded values", () => {
  const original = process.env.CA_SOURCE_URLS;
  try {
    delete process.env.CA_SOURCE_URLS;
    assert.deepEqual(getCaSourceUrls(), []);

    process.env.CA_SOURCE_URLS = "";
    assert.deepEqual(getCaSourceUrls(), []);

    process.env.CA_SOURCE_URLS = "https://example.com/ca";
    assert.deepEqual(getCaSourceUrls(), ["https://example.com/ca"]);

    process.env.CA_SOURCE_URLS = "  https://a.com , https://b.com ,, https://c.com  ";
    assert.deepEqual(getCaSourceUrls(), ["https://a.com", "https://b.com", "https://c.com"]);
  } finally {
    if (original === undefined) delete process.env.CA_SOURCE_URLS;
    else process.env.CA_SOURCE_URLS = original;
  }
});

test("normaliseCategory accepts only known buckets, case- and whitespace-insensitive", () => {
  assert.equal(normaliseCategory("Appointments"), "appointments");
  assert.equal(normaliseCategory("  SCHEMES  "), "schemes");
  assert.equal(normaliseCategory("gossip"), null);
  assert.equal(normaliseCategory(null), null);
  assert.equal(normaliseCategory(""), null);
});

test("expandSourceUrl substitutes date tokens (AffairsCloud-style)", () => {
  const url = expandSourceUrl(
    "https://affairscloud.com/current-affairs-{day}-{month}-{year}/",
    new Date("2026-05-30T00:00:00Z")
  );
  assert.equal(url, "https://affairscloud.com/current-affairs-30-may-2026/");
});

test("expandSourceUrl zero-pads day and month when requested", () => {
  const url = expandSourceUrl(
    "https://example.com/{year}-{month2}-{day2}/",
    new Date("2026-01-05T00:00:00Z")
  );
  assert.equal(url, "https://example.com/2026-01-05/");
});

test("expandSourceUrl leaves untemplated URLs unchanged", () => {
  const url = expandSourceUrl(
    "https://www.gktoday.in/current-affairs/",
    new Date("2026-05-30T00:00:00Z")
  );
  assert.equal(url, "https://www.gktoday.in/current-affairs/");
});

test("expandSourceUrl handles all twelve month names", () => {
  const months = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
  ];
  for (let i = 0; i < 12; i++) {
    // Day 15 is safe in every month — no DST / month-length edge cases.
    const url = expandSourceUrl(
      "{month}",
      new Date(Date.UTC(2026, i, 15))
    );
    assert.equal(url, months[i]);
  }
});

test("isGrounded accepts an LLM excerpt that stripped markdown from the source", () => {
  // Mirrors the real AffairsCloud failure mode: source has bold/link markdown,
  // LLM emits clean prose. Same facts, same order — must still ground.
  const source =
    "In May 2026, the Ministry of Health and Family Welfare " +
    "(**MoH&FW**) released the [National Health Accounts (**NHA**)](https://nhsrcindia.org/2026.pdf) " +
    "report covering FY 2024-25 expenditure.";
  const excerpt =
    "In May 2026, the Ministry of Health and Family Welfare (MoH&FW) " +
    "released the National Health Accounts (NHA) report covering FY 2024-25 expenditure.";
  assert.ok(isGrounded(excerpt, source));
});

test("isGrounded still rejects invented facts after markdown stripping", () => {
  // Same source as above but the excerpt now invents a date and a different
  // ministry. The aggressive normalisation must not let this slip through.
  const source =
    "In May 2026, the Ministry of Health and Family Welfare released the report.";
  const excerpt =
    "In April 2026, the Ministry of Defence released the report on procurement.";
  assert.equal(isGrounded(excerpt, source), false);
});

test("isGrounded rejects invented excerpts and accepts verbatim ones", () => {
  const source =
    "ISRO launched Chandrayaan-3 on 14 July 2023 from Sriharikota. " +
    "The Vikram lander touched down near the lunar south pole.";
  assert.ok(isGrounded("Chandrayaan-3 on 14 July 2023 from Sriharikota", source));
  // Whitespace differences are normalised away, so this should still match.
  assert.ok(isGrounded("Chandrayaan-3   on 14 July 2023\nfrom Sriharikota", source));
  // Fabricated fact not in the source.
  assert.equal(isGrounded("Chandrayaan-3 was launched from Kerala in 2022.", source), false);
  // Too short to be a meaningful match.
  assert.equal(isGrounded("ISRO", source), false);
});
