import { parseFragment, type DefaultTreeAdapterMap } from "parse5";

import type { ArticleBlock, ArticleDocument, ArticleInline } from "./model.js";

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

function inlineFrom(nodes: readonly Node[], skipLists = false): ArticleInline[] {
  const result: ArticleInline[] = [];
  for (const node of nodes) {
    if (isText(node)) {
      result.push({ type: "text", value: node.value.replace(/\s+/g, " ") });
      continue;
    }
    if (!isElement(node) || isExcluded(node)) continue;
    if (skipLists && (node.tagName === "ol" || node.tagName === "ul")) continue;
    const children = inlineFrom(childrenOf(node), skipLists);
    if (node.tagName === "strong" || node.tagName === "b") {
      result.push({ type: "strong", children });
    } else if (node.tagName === "em" || node.tagName === "i") {
      result.push({ type: "emphasis", children });
    } else {
      result.push(...children);
    }
  }
  return compactInline(result);
}

function listFrom(element: Element): ArticleBlock {
  const items = childrenOf(element)
    .filter((child): child is Element => isElement(child) && child.tagName === "li")
    .map((item) => ({
      children: inlineFrom(childrenOf(item), true),
      blocks: childrenOf(item)
        .filter((child): child is Element => isElement(child) && (child.tagName === "ol" || child.tagName === "ul"))
        .map(listFrom),
    }));
  return { type: "list", ordered: element.tagName === "ol", items };
}

function blocksFrom(nodes: readonly Node[]): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  for (const node of nodes) {
    if (!isElement(node) || isExcluded(node)) continue;
    if (/^h[2-6]$/.test(node.tagName)) {
      const level = Number(node.tagName[1]) as 2 | 3 | 4 | 5 | 6;
      const children = inlineFrom(childrenOf(node));
      if (children.some((child) => child.type !== "text" || child.value.trim())) {
        blocks.push({ type: "heading", level, children });
      }
    } else if (node.tagName === "p") {
      const children = inlineFrom(childrenOf(node));
      if (children.some((child) => child.type !== "text" || child.value.trim())) {
        blocks.push({ type: "paragraph", children });
      }
    } else if (node.tagName === "ol" || node.tagName === "ul") {
      const list = listFrom(node);
      if (list.type === "list" && list.items.length > 0) blocks.push(list);
    } else if (node.tagName !== "h1") {
      blocks.push(...blocksFrom(childrenOf(node)));
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

export function normalizeArticleDocument(title: string, untrustedHtml: string): ArticleDocument | null {
  const fragment = parseFragment(untrustedHtml);
  const blocks = normalizeHeadingHierarchy(blocksFrom(fragment.childNodes));
  const hasMeaningfulText = JSON.stringify(blocks).replace(/[\s\W]/g, "").length > 0;
  return hasMeaningfulText ? { title, blocks } : null;
}
