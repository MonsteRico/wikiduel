import type { RawData, WebSocket } from "ws";
import { expect, test } from "vitest";

import type { PlayableArticle, PlayableArticleRepository } from "./playable-articles/index.js";
import { buildApp } from "./app.js";
import type {
  PreviewArticleResultMessage,
  PreviewErrorMessage,
} from "./playable-articles/preview.js";

const article: PlayableArticle = {
  identity: { pageId: 42, title: "Canonical title" },
  revision: { id: 1776, timestamp: "2026-07-04T12:34:56Z" },
  attribution: {
    sourceUrl: "https://en.wikipedia.org/wiki/Canonical_title?oldid=1776",
    historyUrl: "https://en.wikipedia.org/w/index.php?title=Canonical_title&action=history",
    licenseName: "Creative Commons Attribution-ShareAlike 4.0 International",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    modificationNotice: "Wiki Duel simplified and modified this Wikipedia article.",
  },
  document: {
    title: "Canonical title",
    blocks: [
      {
        type: "paragraph",
        children: [{ type: "text", value: "A safe article." }],
      },
    ],
  },
};

function nextMessage<T>(socket: WebSocket, type: string): Promise<T> {
  return new Promise((resolve) => {
    const onMessage = (data: RawData) => {
      const message = JSON.parse(data.toString()) as { type: string };
      if (message.type === type) {
        socket.off("message", onMessage);
        resolve(message as T);
      }
    };
    socket.on("message", onMessage);
  });
}

test("the preview WebSocket returns a canonical article and separate safe diagnostics", async () => {
  const repository: PlayableArticleRepository = {
    getByTitle: async () => ({ ok: true, article }),
  };
  const app = await buildApp({ repository });
  await app.ready();

  const socket = await app.injectWS("/ws");
  const responsePromise = nextMessage<{
    type: "preview-article-result";
    requestId: string;
    requestedTitle: string;
    ok: true;
    article: PlayableArticle;
    diagnostics: {
      requestedTitle: string;
      canonicalIdentity: { pageId: number; title: string };
      revision: { id: number; timestamp: string };
      durationMs: number;
      cacheOutcome: string;
      emittedNodeCounts: Record<string, number>;
      omissions: Record<string, unknown>;
    };
  }>(socket, "preview-article-result");

  socket.send(JSON.stringify({
    type: "preview-article",
    requestId: "request-1",
    requestedTitle: "Alias title",
  }));

  const response = await responsePromise;
  expect(response.requestId).toBe("request-1");
  expect(response.requestedTitle).toBe("Alias title");
  expect(response.article).toEqual(article);
  expect(response.diagnostics).toMatchObject({
    requestedTitle: "Alias title",
    canonicalIdentity: article.identity,
    revision: article.revision,
    cacheOutcome: "miss",
    emittedNodeCounts: expect.objectContaining({ paragraphs: 1, text: 1 }),
  });
  expect(response.diagnostics.durationMs).toEqual(expect.any(Number));
  expect(response.diagnostics.omissions).toEqual(expect.any(Object));
  expect(JSON.stringify(response)).not.toContain("<html");
  expect(JSON.stringify(response)).not.toContain("stack");

  socket.terminate();
  await app.close();
});

test("preview requests correlate repeated and Navigation requests with typed failures without changing Lobby messages", async () => {
  const requestedTitles: string[] = [];
  const repository: PlayableArticleRepository = {
    getByTitle: async (requestedTitle) => {
      requestedTitles.push(requestedTitle);
      if (requestedTitle === "missing") {
        return { ok: false, failure: { code: "article-not-found" } };
      }
      return { ok: true, article };
    },
  };
  const app = await buildApp({ repository });
  await app.ready();
  const socket = await app.injectWS("/ws");

  const firstResponsePromise = nextMessage<PreviewArticleResultMessage>(socket, "preview-article-result");
  socket.send(JSON.stringify({ type: "preview-article", requestId: "first", requestedTitle: "Destination title" }));
  const firstResponse = await firstResponsePromise;
  expect(firstResponse).toMatchObject({ requestId: "first", requestedTitle: "Destination title", ok: true });

  const secondResponsePromise = nextMessage<PreviewArticleResultMessage>(socket, "preview-article-result");
  socket.send(JSON.stringify({ type: "preview-article", requestId: "second", requestedTitle: "missing" }));
  const secondResponse = await secondResponsePromise;
  expect(secondResponse).toMatchObject({
    requestId: "second",
    requestedTitle: "missing",
    ok: false,
    failure: { code: "article-not-found" },
  });
  expect(requestedTitles).toEqual(["Destination title", "missing"]);

  const malformedPromise = nextMessage<PreviewErrorMessage>(socket, "preview-error");
  socket.send(JSON.stringify({ type: "preview-article", requestId: "bad", requestedTitle: 42 }));
  await expect(malformedPromise).resolves.toMatchObject({
    requestId: "bad",
    failure: { code: "malformed-message" },
  });

  const pongPromise = nextMessage<{ type: "pong"; message: string }>(socket, "pong");
  socket.send(JSON.stringify({ type: "ping" }));
  await expect(pongPromise).resolves.toMatchObject({ message: "Pong from WikiDuel server" });

  socket.terminate();
  await app.close();
});

test("the preview command is rejected in production without calling the repository", async () => {
  let calls = 0;
  const repository: PlayableArticleRepository = {
    getByTitle: async () => {
      calls += 1;
      return { ok: true, article };
    },
  };
  const app = await buildApp({ repository, production: true });
  await app.ready();
  const socket = await app.injectWS("/ws");

  const responsePromise = nextMessage<PreviewErrorMessage>(socket, "preview-error");
  socket.send(JSON.stringify({
    type: "preview-article",
    requestId: "production-request",
    requestedTitle: "Ada Lovelace",
  }));

  await expect(responsePromise).resolves.toMatchObject({
    requestId: "production-request",
    requestedTitle: "Ada Lovelace",
    failure: { code: "preview-unavailable" },
  });
  expect(calls).toBe(0);

  socket.terminate();
  await app.close();
});
