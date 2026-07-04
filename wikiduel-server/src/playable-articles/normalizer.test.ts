import { describe, expect, test } from "vitest";

import { normalizeArticleDocument } from "./normalizer.js";

describe("normalizeArticleDocument", () => {
  test("preserves the supported article vocabulary and nested ordinary lists", () => {
    const result = normalizeArticleDocument("Ada Lovelace", `
      <section><h2>Biography</h2>
      <p>A <strong>mathematician</strong> and <em>writer</em>.</p>
      <ol><li>First<ul><li>Nested <b>fact</b></li></ul></li></ol></section>
    `);

    expect(result).toEqual({
      title: "Ada Lovelace",
      blocks: [
        { type: "heading", level: 2, children: [{ type: "text", value: "Biography" }] },
        {
          type: "paragraph",
          children: [
            { type: "text", value: "A " },
            { type: "strong", children: [{ type: "text", value: "mathematician" }] },
            { type: "text", value: " and " },
            { type: "emphasis", children: [{ type: "text", value: "writer" }] },
            { type: "text", value: "." },
          ],
        },
        {
          type: "list",
          ordered: true,
          items: [{
            children: [{ type: "text", value: "First" }],
            blocks: [{
              type: "list",
              ordered: false,
              items: [{
                children: [
                  { type: "text", value: "Nested " },
                  { type: "strong", children: [{ type: "text", value: "fact" }] },
                ],
                blocks: [],
              }],
            }],
          }],
        },
      ],
    });
  });

  test("drops executable and unsupported subtrees without exposing raw HTML", () => {
    const result = normalizeArticleDocument("Safe", `
      <h1 onclick="steal()">Untrusted duplicate title</h1>
      <p onmouseover="steal()">Readable <a href="javascript:steal()">label</a></p>
      <script>alert(1)</script><style>body { display: none }</style>
      <table><tr><td>unsupported table secret</td></tr></table>
      <div class="navbox"><p>navigation chrome</p></div>
    `);

    expect(result).toEqual({
      title: "Safe",
      blocks: [{
        type: "paragraph",
        children: [{ type: "text", value: "Readable label" }],
      }],
    });
    expect(JSON.stringify(result)).not.toMatch(/onclick|javascript:|script|table secret|chrome/);
  });

  test("returns no document when supported meaningful text cannot be produced", () => {
    expect(normalizeArticleDocument("Empty", "<script>alert(1)</script><table><tr><td>x</td></tr></table>"))
      .toBeNull();
  });
});
