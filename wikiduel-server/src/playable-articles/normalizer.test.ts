import { describe, expect, test } from "vitest";

import {
  extractCandidateImageTitles,
  extractCandidateLinkTitles,
  createNormalizationDiagnostics,
  normalizeArticleDocument,
} from "./normalizer.js";

describe("normalizeArticleDocument", () => {
  test("discovers figures in article prose and supported Infoboxes while excluding other structures", () => {
    const figure = (title: string) => `
      <figure typeof="mw:File/Thumb"><a href="/wiki/File:${title}"><img alt="${title}"></a></figure>
    `;
    const html = `
      ${figure("Article.jpg")}
      <table class="infobox"><tr><td>${figure("Infobox.jpg")}</td></tr></table>
      <figure class="static-map" typeof="mw:File/Thumb"><a href="/wiki/File:Static_map.jpg"><img alt="Static map"></a></figure>
      <div class="mw-kartographer"><figure typeof="mw:File/Thumb"><a href="/wiki/File:Interactive_map.jpg"><img alt="Interactive map"></a></figure></div>
      <table><tr><td>${figure("Table.jpg")}</td></tr></table>
      <div class="gallery">${figure("Gallery.jpg")}</div>
      <div class="navbox">${figure("Navbox.jpg")}</div>
      <div class="ambox">${figure("Notice.jpg")}</div>
      <div class="mbox-small">${figure("Other_notice.jpg")}</div>
      <div class="reference">${figure("Reference.jpg")}</div>
      <div class="mw-kartographer">${figure("Map.jpg")}</div>
    `;

    expect(extractCandidateImageTitles(html)).toEqual([
      "File:Article.jpg",
      "File:Infobox.jpg",
      "File:Static map.jpg",
    ]);
  });

  test("retains ordered Infobox sections, facts, lists, links, figures, and media placeholders", () => {
    const figures = new Map([[
      "File:Ada portrait.jpg",
      {
        sourceUrl: "https://upload.wikimedia.org/wikipedia/commons/a/ada.jpg",
        width: 320,
        height: 400,
        attribution: {
          descriptionUrl: "https://commons.wikimedia.org/wiki/File:Ada_portrait.jpg",
          historyUrl: "https://commons.wikimedia.org/w/index.php?title=File%3AAda_portrait.jpg&action=history",
          licenseName: "Public domain",
          licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
        },
      },
    ]]);
    const destinations = new Map([
      ["Ada Lovelace", { pageId: 1, title: "Ada Lovelace" }],
      ["London", { pageId: 2, title: "London" }],
      ["Analytical Engine", { pageId: 3, title: "Analytical Engine" }],
    ]);
    const html = `
      <table class="infobox biography vcard">
        <tr><th class="infobox-above" colspan="2"><a href="/wiki/Ada_Lovelace">Ada Lovelace</a></th></tr>
        <tr><th class="infobox-label">Born</th><td>10 December<br><a href="/wiki/London">London</a></td></tr>
        <tr><th class="infobox-header" colspan="2">Known for</th></tr>
        <tr><td colspan="2"><p>Computing pioneer</p><ul><li><a href="/wiki/Analytical_Engine">Analytical Engine</a></li></ul></td></tr>
        <tr><td colspan="2"><figure typeof="mw:File/Thumb"><a href="/wiki/File:Ada_portrait.jpg"><img alt="Portrait of Ada Lovelace"></a><figcaption>Portrait</figcaption></figure></td></tr>
        <tr><td colspan="2"><audio src="secret.mp3"></audio><video src="secret.mp4"></video></td></tr>
      </table>
      <p>Article body.</p>
    `;

    expect(normalizeArticleDocument("Ada Lovelace", html, destinations, figures)).toEqual({
      title: "Ada Lovelace",
      tableOfContents: [],
      blocks: [
        {
          type: "infobox",
          title: [{
            type: "navigation",
            destination: { pageId: 1, title: "Ada Lovelace" },
            children: [{ type: "text", value: "Ada Lovelace" }],
          }],
          sections: [
            {
              items: [{
                label: [{ type: "text", value: "Born" }],
                blocks: [
                  { type: "line", children: [{ type: "text", value: "10 December" }] },
                  {
                    type: "line",
                    children: [
                      { type: "navigation", destination: { pageId: 2, title: "London" }, children: [{ type: "text", value: "London" }] },
                    ],
                  },
                ],
              }],
            },
            {
              label: [{ type: "text", value: "Known for" }],
              items: [{
                blocks: [
                  { type: "paragraph", children: [{ type: "text", value: "Computing pioneer" }] },
                  {
                    type: "list",
                    ordered: false,
                    items: [{
                      children: [{
                        type: "navigation",
                        destination: { pageId: 3, title: "Analytical Engine" },
                        children: [{ type: "text", value: "Analytical Engine" }],
                      }],
                      blocks: [],
                    }],
                  },
                ],
              }, {
                blocks: [{
                  type: "figure",
                  sourceUrl: "https://upload.wikimedia.org/wikipedia/commons/a/ada.jpg",
                  width: 320,
                  height: 400,
                  alt: "Portrait of Ada Lovelace",
                  caption: [{ type: "text", value: "Portrait" }],
                  attribution: figures.get("File:Ada portrait.jpg")?.attribution,
                }],
              }, {
                blocks: [
                  { type: "media-placeholder", kind: "audio" },
                  { type: "media-placeholder", kind: "video" },
                ],
              }],
            },
          ],
        },
        { type: "paragraph", children: [{ type: "text", value: "Article body." }] },
      ],
    });
  });

  test("does not let Infobox-only content satisfy the meaningful article-body requirement", () => {
    expect(normalizeArticleDocument("Infobox only", `
      <table class="infobox"><tr><th class="infobox-above">A fact card</th></tr></table>
    `)).toBeNull();
  });

  test("keeps supported Infobox siblings when an item contains hostile or unsupported descendants", () => {
    const diagnostics = createNormalizationDiagnostics();
    const result = normalizeArticleDocument("Place", `
      <table class="infobox">
        <tr><th class="infobox-label">Location</th><td>
          <span>Readable before</span>
          <table><tr><td>secret table</td></tr></table>
          <a href="/wiki/Unknown">Readable destination label</a>
        </td></tr>
        <tr><th class="infobox-label">Map</th><td>
          <div class="mw-kartographer"><script>steal()</script></div>
          <p>Coordinates remain readable.</p>
        </td></tr>
        <tr><td><script>drop me</script><object data="run"></object></td></tr>
      </table>
      <p>Article body.</p>
    `, new Map(), new Map(), diagnostics);

    expect(result).toMatchObject({
      blocks: [
        {
          type: "infobox",
          sections: [{
            items: [
              {
                label: [{ type: "text", value: "Location" }],
                blocks: [
                  { type: "line", children: [{ type: "text", value: " Readable before " }] },
                  { type: "line", children: [{ type: "text", value: " Readable destination label " }] },
                ],
              },
              {
                label: [{ type: "text", value: "Map" }],
                blocks: [{ type: "paragraph", children: [{ type: "text", value: "Coordinates remain readable." }] }],
              },
            ],
          }],
        },
        { type: "paragraph" },
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(/secret table|steal|drop me|run/);
    expect(diagnostics.structure.reasons).toEqual(
      new Set(["table", "interactive-map", "script", "object"]),
    );
    expect(diagnostics.links.reasons).toEqual(new Set(["unresolved-or-not-playable"]));
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
      tableOfContents: [{ targetId: "section-biography", level: 2, label: "Biography" }],
      blocks: [
        {
          type: "heading",
          targetId: "section-biography",
          level: 2,
          children: [{ type: "text", value: "Biography" }],
        },
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
      tableOfContents: [],
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
      {
        type: "heading",
        targetId: "section-first",
        level: 2,
        children: [{ type: "text", value: "First" }],
      },
      {
        type: "heading",
        targetId: "section-child",
        level: 3,
        children: [{ type: "text", value: "Child" }],
      },
      {
        type: "heading",
        targetId: "section-sibling",
        level: 2,
        children: [{ type: "text", value: "Sibling" }],
      },
    ]);
  });

  test("excludes MediaWiki table-of-contents chrome and keeps its links out of candidates", () => {
    const html = `
      <div id="toc" class="toc" role="navigation" aria-labelledby="mw-toc-heading">
        <div id="mw-toc-heading">Contents</div>
        <ul>
          <li class="toclevel-1 tocsection-1">
            <a href="#History"><span class="tocnumber">1</span> <span class="toctext">History</span></a>
          </li>
          <li><a href="/wiki/Chrome_only">Chrome-only link</a></li>
        </ul>
      </div>
      <nav id="mw-panel-toc" class="vector-toc">
        <div>Contents</div>
        <ul><li><a href="#Culture">Culture</a></li></ul>
      </nav>
      <p>Readable <a href="/wiki/Real_destination">article link</a>.</p>
      <h2>History</h2>
    `;
    const diagnostics = createNormalizationDiagnostics();
    const destinations = new Map([[
      "Real destination",
      { pageId: 9, title: "Real destination" },
    ]]);

    expect(extractCandidateLinkTitles(html)).toEqual(["Real destination"]);
    expect(normalizeArticleDocument("TOC", html, destinations, new Map(), diagnostics)).toEqual({
      title: "TOC",
      tableOfContents: [{ targetId: "section-history", level: 2, label: "History" }],
      blocks: [
        {
          type: "paragraph",
          children: [
            { type: "text", value: "Readable " },
            {
              type: "navigation",
              destination: { pageId: 9, title: "Real destination" },
              children: [{ type: "text", value: "article link" }],
            },
            { type: "text", value: "." },
          ],
        },
        {
          type: "heading",
          targetId: "section-history",
          level: 2,
          children: [{ type: "text", value: "History" }],
        },
      ],
    });
    expect(diagnostics.structure.reasons).toEqual(new Set(["toc", "vector-toc"]));
  });

  test("derives deterministic table-of-contents entries from retained normalized headings", () => {
    const result = normalizeArticleDocument("Outline", `
      <h3>Early life</h3>
      <h5>Skipped level repaired</h5>
      <h2><a href="https://example.invalid">External label</a></h2>
      <h2><span class="mw-editsection">edit</span></h2>
      <h2>Early life</h2>
    `);

    expect(result).toEqual({
      title: "Outline",
      tableOfContents: [
        { targetId: "section-early-life", level: 2, label: "Early life" },
        { targetId: "section-skipped-level-repaired", level: 3, label: "Skipped level repaired" },
        { targetId: "section-external-label", level: 2, label: "External label" },
        { targetId: "section-early-life-2", level: 2, label: "Early life" },
      ],
      blocks: [
        {
          type: "heading",
          targetId: "section-early-life",
          level: 2,
          children: [{ type: "text", value: "Early life" }],
        },
        {
          type: "heading",
          targetId: "section-skipped-level-repaired",
          level: 3,
          children: [{ type: "text", value: "Skipped level repaired" }],
        },
        {
          type: "heading",
          targetId: "section-external-label",
          level: 2,
          children: [{ type: "text", value: "External label" }],
        },
        {
          type: "heading",
          targetId: "section-early-life-2",
          level: 2,
          children: [{ type: "text", value: "Early life" }],
        },
      ],
    });
  });
});
