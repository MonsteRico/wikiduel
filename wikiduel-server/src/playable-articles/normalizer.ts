import { parseFragment, type DefaultTreeAdapterMap } from "parse5";

import type {
  ArticleBlock,
  ArticleDocument,
  ArticleFigure,
  ArticleInline,
  ArticleTableOfContentsEntry,
  NavigationDestination,
} from "./model.js";
import { isValidWikipediaTitle } from "./title.js";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];

export type NormalizationOmissionDetail = Readonly<{
  reason: string;
  subject?: string;
}>;

export type NormalizationDiagnostics = {
  structure: { count: number; reasons: Set<string>; examples: NormalizationOmissionDetail[] };
  links: { count: number; reasons: Set<string>; examples: NormalizationOmissionDetail[] };
  images: { count: number; reasons: Set<string>; examples: NormalizationOmissionDetail[] };
};

const MAX_DIAGNOSTIC_EXAMPLES = 25;

export function createNormalizationDiagnostics(): NormalizationDiagnostics {
  return {
    structure: { count: 0, reasons: new Set(), examples: [] },
    links: { count: 0, reasons: new Set(), examples: [] },
    images: { count: 0, reasons: new Set(), examples: [] },
  };
}

function recordOmission(
  diagnostics: NormalizationDiagnostics | undefined,
  category: keyof NormalizationDiagnostics,
  reason: string,
  subject?: string,
): void {
  if (!diagnostics) return;
  diagnostics[category].count += 1;
  diagnostics[category].reasons.add(reason);
  if (diagnostics[category].examples.length >= MAX_DIAGNOSTIC_EXAMPLES) return;
  const normalizedSubject = subject?.replace(/\s+/g, " ").trim().slice(0, 160);
  diagnostics[category].examples.push({
    reason,
    ...(normalizedSubject ? { subject: normalizedSubject } : {}),
  });
}
const EXCLUDED_TAGS = new Set([
  "script", "style", "template", "noscript", "iframe", "object", "embed",
  "table", "audio", "video", "svg", "math", "form", "input", "button",
]);
const EXCLUDED_CLASSES = [
  "navbox", "infobox", "hatnote", "mw-editsection", "reference", "reflist", "gallery",
  "metadata", "ambox", "mbox-small", "tmbox", "ombox", "fmbox", "cmbox", "imbox",
  "vertical-navbox", "mw-kartographer", "mw-kartographer-map",
];
const TOC_CLASSES = ["toc", "mw-toc", "vector-toc", "sidebar-toc"];
const TOC_IDS = new Set(["toc", "mw-panel-toc"]);
const NON_ARTICLE_NAMESPACES = new Set(["category", "file", "help", "special", "talk"]);

function isElement(node: Node): node is Element {
  return "tagName" in node;
}

function isText(node: Node): node is DefaultTreeAdapterMap["textNode"] {
  return node.nodeName === "#text" && "value" in node;
}

function childrenOf(node: Node): Node[] {
  return "childNodes" in node ? node.childNodes : [];
}

function attribute(element: Element, name: string): string | undefined {
  return element.attrs.find((candidate) => candidate.name === name)?.value;
}

function descendant(element: Element, tagName: string): Element | undefined {
  // Parsoid may wrap the actual <img> in links or spans inside a figure. The
  // normalizer still needs the image alt text, so this searches structurally
  // instead of assuming a direct child layout.
  for (const child of childrenOf(element)) {
    if (!isElement(child)) continue;
    if (child.tagName === tagName) return child;
    const nested = descendant(child, tagName);
    if (nested) return nested;
  }
  return undefined;
}

function isExcluded(element: Element): boolean {
  if (EXCLUDED_TAGS.has(element.tagName)) return true;
  if (tableOfContentsReason(element)) return true;
  const className = element.attrs.find((attribute) => attribute.name === "class")?.value ?? "";
  const classes = new Set(className.split(/\s+/));
  return EXCLUDED_CLASSES.some((excluded) => classes.has(excluded));
}

function structureOmissionReason(element: Element): string {
  if (EXCLUDED_TAGS.has(element.tagName)) return element.tagName;
  const tocReason = tableOfContentsReason(element);
  if (tocReason) return tocReason;
  const className = element.attrs.find((attribute) => attribute.name === "class")?.value ?? "";
  return EXCLUDED_CLASSES.find((excluded) => className.split(/\s+/).includes(excluded))
    ?? "unsupported-structure";
}

function tableOfContentsReason(element: Element): string | undefined {
  const id = attribute(element, "id");
  if (id && TOC_IDS.has(id)) return id === "toc" ? "toc" : "vector-toc";
  const classes = new Set((attribute(element, "class") ?? "").split(/\s+/));
  return TOC_CLASSES.find((tocClass) => classes.has(tocClass));
}

function plainTextFromNodes(nodes: readonly Node[]): string {
  const parts: string[] = [];
  const visit = (children: readonly Node[]) => {
    for (const child of children) {
      if (isText(child)) {
        parts.push(child.value);
      } else if (isElement(child) && !isExcluded(child)) {
        visit(childrenOf(child));
      }
    }
  };
  visit(nodes);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function compactInline(nodes: readonly ArticleInline[]): ArticleInline[] {
  const compacted: ArticleInline[] = [];
  for (const node of nodes) {
    if (node.type === "text") {
      if (!node.value) continue;
      const previous = compacted.at(-1);
      if (previous?.type === "text") {
        compacted[compacted.length - 1] = { type: "text", value: previous.value + node.value };
      } else {
        compacted.push(node);
      }
    } else if (node.children.length > 0) {
      compacted.push(node);
    }
  }
  return compacted;
}

function plainTextFromInlines(nodes: readonly ArticleInline[]): string {
  const parts: string[] = [];
  const visit = (children: readonly ArticleInline[]) => {
    for (const child of children) {
      if (child.type === "text") {
        parts.push(child.value);
      } else {
        visit(child.children);
      }
    }
  };
  visit(nodes);
  return parts.join("").replace(/\s+/g, " ").trim();
}

function linkTitle(element: Element): string | undefined {
  // Reduce an untrusted anchor to the Wikipedia title that may be sent to the
  // gateway for resolution. Returning undefined keeps the anchor's label as
  // readable plain text instead of turning it into a Navigation Node.
  const className = element.attrs.find((attribute) => attribute.name === "class")?.value ?? "";
  // MediaWiki marks links to pages that do not exist with the `new` class.
  if (className.split(/\s+/).includes("new")) return undefined;
  const href = element.attrs.find((attribute) => attribute.name === "href")?.value;
  // Only ordinary article paths are candidates. Query strings identify edit,
  // search, red-link, and other controls rather than canonical destinations.
  if (!href?.startsWith("/wiki/") || href.includes("?")) return undefined;
  const encodedTitle = href.slice("/wiki/".length).split(/[?#]/, 1)[0];
  if (!encodedTitle) return undefined;
  try {
    // Convert URL spelling into the title spelling expected by MediaWiki while
    // rejecting malformed escapes and characters forbidden in page titles.
    const title = decodeURIComponent(encodedTitle).replace(/_/g, " ");
    if (!isValidWikipediaTitle(title)) return undefined;
    const colon = title.indexOf(":");
    const namespace = colon < 0 ? "" : title.slice(0, colon).toLocaleLowerCase("en-US");
    // Known non-article namespaces can be discarded without an upstream call;
    // the resolved-metadata classifier remains authoritative for all others.
    return NON_ARTICLE_NAMESPACES.has(namespace) ? undefined : title;
  } catch {
    return undefined;
  }
}

function hasMeaningfulInline(nodes: readonly ArticleInline[]): boolean {
  // A figure must carry either useful alt text or useful caption text. This
  // keeps attribution-only media from producing empty visual blocks while still
  // allowing captions made of emphasis/Navigation Nodes to count as meaningful.
  return nodes.some((node) => node.type === "text"
    ? Boolean(node.value.trim())
    : hasMeaningfulInline(node.children));
}

function imageTitle(element: Element): string | undefined {
  // We identify figures by MediaWiki's structural `mw:File/*` marker, not by
  // incidental class names. That keeps the figure path tied to article content
  // that Parsoid says is a file transclusion, and lets excluded containers
  // handle infoboxes, galleries, navboxes, maps, and other non-body media.
  if (
    element.tagName !== "figure"
    || !/^mw:File\/(?:Thumb|Frame|Frameless)$/.test(attribute(element, "typeof") ?? "")
  ) {
    return undefined;
  }
  const hasInterfaceMarker = (candidate: Element): boolean => {
    const classes = new Set((attribute(candidate, "class") ?? "").split(/\s+/));
    return ["noviewer", "mw-ui-icon", "mw-indicator", "icon", "badge"]
      .some((className) => classes.has(className))
      || attribute(candidate, "role") === "presentation"
      || attribute(candidate, "aria-hidden")?.toLocaleLowerCase("en-US") === "true";
  };
  const containsInterfaceMarker = (candidate: Element): boolean => hasInterfaceMarker(candidate)
    || childrenOf(candidate).some((child) => isElement(child) && containsInterfaceMarker(child));
  // Some decorative interface images are still represented as file figures.
  // If any part of the figure declares itself presentational or icon-like, treat
  // the whole candidate as UI chrome rather than article content.
  if (containsInterfaceMarker(element)) return undefined;

  const visit = (nodes: readonly Node[]): string | undefined => {
    for (const node of nodes) {
      if (!isElement(node)) continue;
      if (node.tagName === "a") {
        const href = attribute(node, "href");
        if (href?.startsWith("/wiki/File:") && !href.includes("?")) {
          try {
            // The file page link is the stable title that imageinfo accepts.
            // Thumbnail URLs contain size/path transformations, so deriving the
            // title from `src` would couple us to upload path conventions and
            // make redirects/normalization harder to reason about.
            const encodedTitle = href.slice("/wiki/".length).split(/[?#]/, 1)[0];
            if (!encodedTitle) return undefined;
            const title = decodeURIComponent(encodedTitle)
              .replace(/_/g, " ");
            if (isValidWikipediaTitle(title)) return title;
          } catch {
            return undefined;
          }
        }
      }
      const nested = visit(childrenOf(node));
      if (nested) return nested;
    }
    return undefined;
  };
  return visit(childrenOf(element));
}

function inlineFrom(
  nodes: readonly Node[],
  skipLists = false,
  destinations: ReadonlyMap<string, NavigationDestination> = new Map(),
  diagnostics?: NormalizationDiagnostics,
): ArticleInline[] {
  const result: ArticleInline[] = [];
  for (const node of nodes) {
    if (isText(node)) {
      result.push({ type: "text", value: node.value.replace(/\s+/g, " ") });
      continue;
    }
    if (!isElement(node)) continue;
    if (isExcluded(node)) {
      recordOmission(diagnostics, "structure", structureOmissionReason(node), node.tagName);
      continue;
    }
    if (skipLists && (node.tagName === "ol" || node.tagName === "ul")) continue;
    const children = inlineFrom(childrenOf(node), skipLists, destinations, diagnostics);
    if (node.tagName === "strong" || node.tagName === "b") {
      result.push({ type: "strong", children });
    } else if (node.tagName === "em" || node.tagName === "i") {
      result.push({ type: "emphasis", children });
    } else if (node.tagName === "a") {
      const title = linkTitle(node);
      const destination = title ? destinations.get(title) : undefined;
      if (destination) {
        result.push({ type: "navigation", destination, children });
      } else {
        const label = plainTextFromNodes(childrenOf(node));
        recordOmission(
          diagnostics,
          "links",
          title ? "unresolved-or-not-playable" : "unsupported-link",
          title ? `${title}${label ? ` (${label})` : ""}` : label,
        );
        result.push(...children);
      }
    } else {
      result.push(...children);
    }
  }
  return compactInline(result);
}

function listFrom(
  element: Element,
  destinations: ReadonlyMap<string, NavigationDestination>,
  diagnostics?: NormalizationDiagnostics,
): ArticleBlock {
  const items = childrenOf(element)
    .filter((child): child is Element => isElement(child) && child.tagName === "li")
    .map((item) => ({
      children: inlineFrom(childrenOf(item), true, destinations, diagnostics),
      blocks: childrenOf(item)
        .filter((child): child is Element => isElement(child) && (child.tagName === "ol" || child.tagName === "ul"))
        .map((child) => listFrom(child, destinations, diagnostics)),
    }));
  return { type: "list", ordered: element.tagName === "ol", items };
}

function blocksFrom(
  nodes: readonly Node[],
  destinations: ReadonlyMap<string, NavigationDestination>,
  figures: ReadonlyMap<string, Omit<ArticleFigure, "type" | "alt" | "caption">>,
  diagnostics?: NormalizationDiagnostics,
): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  for (const node of nodes) {
    if (!isElement(node)) continue;
    if (isExcluded(node)) {
      recordOmission(diagnostics, "structure", structureOmissionReason(node), node.tagName);
      continue;
    }
    if (node.tagName === "figure") {
      // Normalization performs the final join between source-position markup
      // and repository-approved image metadata. If the repository did not
      // approve the file title, the original figure leaves no placeholder.
      const title = imageTitle(node);
      const figure = title ? figures.get(title) : undefined;
      if (!figure) {
        recordOmission(diagnostics, "images", "unapproved-or-missing-metadata", title ?? "figure");
        continue;
      }
      const image = descendant(node, "img");
      const captionElement = childrenOf(node)
        .find((child): child is Element => isElement(child) && child.tagName === "figcaption");
      const caption = captionElement
        ? inlineFrom(childrenOf(captionElement), false, destinations, diagnostics)
        : [];
      const alt = image ? (attribute(image, "alt") ?? "").trim() : "";
      // Safe metadata alone is not enough for playable output: the player needs
      // some meaningful textual context for accessibility and article coherence.
      if (!alt && !hasMeaningfulInline(caption)) {
        recordOmission(diagnostics, "images", "missing-accessible-context", title ?? "figure");
        continue;
      }
      blocks.push({ type: "figure", ...figure, alt, caption });
    } else if (/^h[2-6]$/.test(node.tagName)) {
      const level = Number(node.tagName[1]) as 2 | 3 | 4 | 5 | 6;
      const children = inlineFrom(childrenOf(node), false, destinations, diagnostics);
      if (children.some((child) => child.type !== "text" || child.value.trim())) {
        blocks.push({ type: "heading", targetId: "", level, children });
      }
    } else if (node.tagName === "p") {
      const children = inlineFrom(childrenOf(node), false, destinations, diagnostics);
      if (children.some((child) => child.type !== "text" || child.value.trim())) {
        blocks.push({ type: "paragraph", children });
      }
    } else if (node.tagName === "ol" || node.tagName === "ul") {
      const list = listFrom(node, destinations, diagnostics);
      if (list.type === "list" && list.items.length > 0) blocks.push(list);
    } else if (node.tagName !== "h1") {
      blocks.push(...blocksFrom(childrenOf(node), destinations, figures, diagnostics));
    }
  }
  return blocks;
}

function normalizeHeadingHierarchy(blocks: readonly ArticleBlock[]): ArticleBlock[] {
  const firstHeading = blocks.find((block) => block.type === "heading");
  if (!firstHeading || firstHeading.type !== "heading") return [...blocks];
  const offset = firstHeading.level - 2;
  let previousLevel = 1;

  return blocks.map((block) => {
    if (block.type !== "heading") return block;
    const relativeLevel = Math.max(2, block.level - offset) as 2 | 3 | 4 | 5 | 6;
    const level = Math.min(relativeLevel, previousLevel + 1, 6) as 2 | 3 | 4 | 5 | 6;
    previousLevel = level;
    return { ...block, level };
  });
}

function targetIdFromLabel(label: string): string {
  const slug = label
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `section-${slug || "heading"}`;
}

function addHeadingTargets(
  blocks: readonly ArticleBlock[],
): Readonly<{ blocks: readonly ArticleBlock[]; tableOfContents: readonly ArticleTableOfContentsEntry[] }> {
  const tableOfContents: ArticleTableOfContentsEntry[] = [];
  const targetCounts = new Map<string, number>();

  const nextTargetId = (label: string) => {
    const base = targetIdFromLabel(label);
    const count = targetCounts.get(base) ?? 0;
    targetCounts.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  };

  const visit = (candidates: readonly ArticleBlock[]): readonly ArticleBlock[] => candidates.map((block) => {
    if (block.type === "heading") {
      const label = plainTextFromInlines(block.children);
      const targetId = nextTargetId(label);
      tableOfContents.push({ targetId, level: block.level, label });
      return { ...block, targetId };
    }
    if (block.type === "list") {
      return {
        ...block,
        items: block.items.map((item) => ({
          ...item,
          blocks: visit(item.blocks),
        })),
      };
    }
    return block;
  });

  return { blocks: visit(blocks), tableOfContents };
}

export function extractCandidateLinkTitles(untrustedHtml: string): readonly string[] {
  const fragment = parseFragment(untrustedHtml);
  const titles = new Set<string>();
  const visit = (nodes: readonly Node[]) => {
    for (const node of nodes) {
      if (!isElement(node) || isExcluded(node)) continue;
      if (node.tagName === "figure") {
        // Figure captions use the same Navigation Node contract as prose, but
        // links elsewhere inside a figure usually point at file/download chrome.
        // Only captions contribute candidate article destinations.
        for (const child of childrenOf(node)) {
          if (isElement(child) && child.tagName === "figcaption") visit(childrenOf(child));
        }
        continue;
      }
      if (node.tagName === "a") {
        const title = linkTitle(node);
        if (title) titles.add(title);
      }
      visit(childrenOf(node));
    }
  };
  visit(fragment.childNodes);
  return [...titles];
}

export function extractCandidateImageTitles(untrustedHtml: string): readonly string[] {
  // This is the cheap discovery pass used before normalization. It returns only
  // file titles that appear as supported source-position figures; the repository
  // then asks Wikimedia for attribution metadata and decides which are safe.
  const fragment = parseFragment(untrustedHtml);
  const titles = new Set<string>();
  const visit = (nodes: readonly Node[]) => {
    for (const node of nodes) {
      if (!isElement(node) || isExcluded(node)) continue;
      if (node.tagName === "figure") {
        const title = imageTitle(node);
        if (title) titles.add(title);
        continue;
      }
      visit(childrenOf(node));
    }
  };
  visit(fragment.childNodes);
  return [...titles];
}

export function normalizeArticleDocument(
  title: string,
  untrustedHtml: string,
  destinations: ReadonlyMap<string, NavigationDestination> = new Map(),
  figures: ReadonlyMap<string, Omit<ArticleFigure, "type" | "alt" | "caption">> = new Map(),
  diagnostics?: NormalizationDiagnostics,
): ArticleDocument | null {
  const fragment = parseFragment(untrustedHtml);
  const normalizedBlocks = normalizeHeadingHierarchy(blocksFrom(fragment.childNodes, destinations, figures, diagnostics));
  const { blocks, tableOfContents } = addHeadingTargets(normalizedBlocks);
  const hasMeaningfulText = JSON.stringify(blocks).replace(/[\s\W]/g, "").length > 0;
  return hasMeaningfulText ? { title, tableOfContents, blocks } : null;
}
