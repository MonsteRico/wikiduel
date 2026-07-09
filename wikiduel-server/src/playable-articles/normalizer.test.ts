import { describe, expect, test } from "vitest";

import { extractCandidateImageTitles, normalizeArticleDocument } from "./normalizer.js";

describe("normalizeArticleDocument", () => {
  test("discovers figures only in supported article-body structure", () => {
    const figure = (title: string) => `
      <figure typeof="mw:File/Thumb"><a href="/wiki/File:${title}"><img alt="${title}"></a></figure>
    `;
    const html = `
      ${figure("Article.jpg")}
      <table class="infobox"><tr><td>${figure("Infobox.jpg")}</td></tr></table>
      <table><tr><td>${figure("Table.jpg")}</td></tr></table>
      <div class="gallery">${figure("Gallery.jpg")}</div>
      <div class="navbox">${figure("Navbox.jpg")}</div>
      <div class="ambox">${figure("Notice.jpg")}</div>
      <div class="mbox-small">${figure("Other_notice.jpg")}</div>
      <div class="reference">${figure("Reference.jpg")}</div>
      <div class="mw-kartographer">${figure("Map.jpg")}</div>
    `;

    expect(extractCandidateImageTitles(html)).toEqual(["File:Article.jpg"]);
  });

  test("discovers ordinary framed, thumbnail, and frameless file figures", () => {
    const html = ["Thumb", "Frame", "Frameless"].map((kind) => `
      <figure typeof="mw:File/${kind}">
        <a href="/wiki/File:${kind}.jpg"><img alt="${kind}"></a>
      </figure>
    `).join("");

    expect(extractCandidateImageTitles(html)).toEqual([
      "File:Thumb.jpg",
      "File:Frame.jpg",
      "File:Frameless.jpg",
    ]);
  });

  test("does not discover figures marked as decorative or interface media", () => {
    const html = `
      <figure typeof="mw:File/Thumb" class="noviewer">
        <a href="/wiki/File:Interface.jpg"><img alt="Interface"></a>
      </figure>
      <figure typeof="mw:File/Thumb">
        <a href="/wiki/File:Presentation.jpg"><img role="presentation" alt="Presentation"></a>
      </figure>
      <figure typeof="mw:File/Thumb">
        <a href="/wiki/File:Hidden.jpg"><img aria-hidden="true" alt="Hidden"></a>
      </figure>
      <figure typeof="mw:File/Thumb">
        <a href="/wiki/File:Icon.jpg"><img class="mw-ui-icon" alt="Icon"></a>
      </figure>
      <figure typeof="mw:File/Thumb" class="badge">
        <a href="/wiki/File:Badge.jpg"><img alt="Badge"></a>
      </figure>
    `;

    expect(extractCandidateImageTitles(html)).toEqual([]);
  });

  test("omits a figure that has neither meaningful alternative text nor a caption", () => {
    const figures = new Map([[
      "File:Spacer.gif",
      {
        sourceUrl: "https://upload.wikimedia.org/wikipedia/commons/s/spacer.gif",
        width: 1,
        height: 1,
        attribution: {
          descriptionUrl: "https://commons.wikimedia.org/wiki/File:Spacer.gif",
          historyUrl: "https://commons.wikimedia.org/w/index.php?title=File%3ASpacer.gif&action=history",
          licenseName: "CC0",
          licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        },
      },
    ]]);

    const result = normalizeArticleDocument("Decorative", `
      <p>Readable article text.</p>
      <figure typeof="mw:File/Thumb">
        <a href="/wiki/File:Spacer.gif"><img alt="" src="tracking.gif"></a>
        <figcaption>   </figcaption>
      </figure>
    `, new Map(), figures);

    expect(result?.blocks).toEqual([{
      type: "paragraph",
      children: [{ type: "text", value: "Readable article text." }],
    }]);
  });

  test("retains meaningful alternative text through incidental figure containers", () => {
    const figure = {
      sourceUrl: "https://upload.wikimedia.org/wikipedia/commons/a/article.jpg",
      width: 200,
      height: 100,
      attribution: {
        descriptionUrl: "https://commons.wikimedia.org/wiki/File:Article.jpg",
        historyUrl: "https://commons.wikimedia.org/w/index.php?title=File%3AArticle.jpg&action=history",
        licenseName: "CC BY 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      },
    };

    const result = normalizeArticleDocument("Nested image", `
      <figure typeof="mw:File/Thumb">
        <a href="/wiki/File:Article.jpg"><span><img alt="Nested portrait"></span></a>
      </figure>
    `, new Map(), new Map([["File:Article.jpg", figure]]));

    expect(result?.blocks).toMatchObject([{ type: "figure", alt: "Nested portrait" }]);
  });

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

  test("repairs source heading jumps beneath the document title", () => {
    const result = normalizeArticleDocument(
      "Hierarchy",
      "<h4>First</h4><h6>Child</h6><h3>Sibling</h3>",
    );

    expect(result?.blocks).toEqual([
      { type: "heading", level: 2, children: [{ type: "text", value: "First" }] },
      { type: "heading", level: 3, children: [{ type: "text", value: "Child" }] },
      { type: "heading", level: 2, children: [{ type: "text", value: "Sibling" }] },
    ]);
  });
});
