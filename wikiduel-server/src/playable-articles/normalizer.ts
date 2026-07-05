import { parseFragment, type DefaultTreeAdapterMap } from "parse5";

import type {
  ArticleBlock,
  ArticleDocument,
  ArticleInline,
  NavigationDestination,
} from "./model.js";
import { isValidWikipediaTitle } from "./title.js";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];
const EXCLUDED_TAGS = new Set([
  "script", "style", "template", "noscript", "iframe", "object", "embed",
  "table", "figure", "audio", "video", "svg", "math", "form", "input", "button",
]);
const EXCLUDED_CLASSES = [
  "navbox", "infobox", "hatnote", "mw-editsection", "reference", "reflist", "gallery",
  "metadata", "ambox", "vertical-navbox",
];
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

function isExcluded(element: Element): boolean {
  if (EXCLUDED_TAGS.has(element.tagName)) return true;
  const className = element.attrs.find((attribute) => attribute.name === "class")?.value ?? "";
  const classes = new Set(className.split(/\s+/));
  return EXCLUDED_CLASSES.some((excluded) => classes.has(excluded));
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

function inlineFrom(
  nodes: readonly Node[],
  skipLists = false,
  destinations: ReadonlyMap<string, NavigationDestination> = new Map(),
): ArticleInline[] {
  const result: ArticleInline[] = [];
  for (const node of nodes) {
    if (isText(node)) {
      result.push({ type: "text", value: node.value.replace(/\s+/g, " ") });
      continue;
    }
    if (!isElement(node) || isExcluded(node)) continue;
    if (skipLists && (node.tagName === "ol" || node.tagName === "ul")) continue;
    const children = inlineFrom(childrenOf(node), skipLists, destinations);
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
): ArticleBlock {
  const items = childrenOf(element)
    .filter((child): child is Element => isElement(child) && child.tagName === "li")
    .map((item) => ({
      children: inlineFrom(childrenOf(item), true, destinations),
      blocks: childrenOf(item)
        .filter((child): child is Element => isElement(child) && (child.tagName === "ol" || child.tagName === "ul"))
        .map((child) => listFrom(child, destinations)),
    }));
  return { type: "list", ordered: element.tagName === "ol", items };
}

function blocksFrom(
  nodes: readonly Node[],
  destinations: ReadonlyMap<string, NavigationDestination>,
): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  for (const node of nodes) {
    if (!isElement(node) || isExcluded(node)) continue;
    if (/^h[2-6]$/.test(node.tagName)) {
      const level = Number(node.tagName[1]) as 2 | 3 | 4 | 5 | 6;
      const children = inlineFrom(childrenOf(node), false, destinations);
      if (children.some((child) => child.type !== "text" || child.value.trim())) {
        blocks.push({ type: "heading", level, children });
      }
    } else if (node.tagName === "p") {
      const children = inlineFrom(childrenOf(node), false, destinations);
      if (children.some((child) => child.type !== "text" || child.value.trim())) {
        blocks.push({ type: "paragraph", children });
      }
    } else if (node.tagName === "ol" || node.tagName === "ul") {
      const list = listFrom(node, destinations);
      if (list.type === "list" && list.items.length > 0) blocks.push(list);
    } else if (node.tagName !== "h1") {
      blocks.push(...blocksFrom(childrenOf(node), destinations));
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

export function extractCandidateLinkTitles(untrustedHtml: string): readonly string[] {
  const fragment = parseFragment(untrustedHtml);
  const titles = new Set<string>();
  const visit = (nodes: readonly Node[]) => {
    for (const node of nodes) {
      if (!isElement(node) || isExcluded(node)) continue;
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

export function normalizeArticleDocument(
  title: string,
  untrustedHtml: string,
  destinations: ReadonlyMap<string, NavigationDestination> = new Map(),
): ArticleDocument | null {
  const fragment = parseFragment(untrustedHtml);
  const blocks = normalizeHeadingHierarchy(blocksFrom(fragment.childNodes, destinations));
  const hasMeaningfulText = JSON.stringify(blocks).replace(/[\s\W]/g, "").length > 0;
  return hasMeaningfulText ? { title, blocks } : null;
}
