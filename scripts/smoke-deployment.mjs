import assert from "node:assert/strict";

const origin = new URL(process.argv[2] ?? "http://localhost:8080").origin;
for (const [path, status, contentType] of [
  ["/health", 200, "application/json"],
  ["/ready", 200, "application/json"],
  ["/", 200, "text/html"],
  ["/lobby/ABCDE", 200, "text/html"],
  ["/duel/example", 200, "text/html"],
  ["/lab", 404, "application/json"],
  ["/assets/missing.js", 404, "application/json"],
  ["/api/unknown", 404, "application/json"],
]) {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, status, path);
  assert.ok(response.headers.get("content-type")?.includes(contentType), path);
  if (path === "/ready") assert.deepEqual(await response.json(), { status: "ready" });
  console.log(`${path}: ${status}`);
}

const websocketUrl = new URL("/ws", origin);
websocketUrl.protocol = websocketUrl.protocol === "https:" ? "wss:" : "ws:";
await new Promise((resolve, reject) => {
  const socket = new WebSocket(websocketUrl);
  const timer = setTimeout(() => finish(new Error("WebSocket welcome timed out")), 5000);
  function finish(error) {
    clearTimeout(timer);
    socket.close();
    if (error) reject(error);
    else resolve();
  }
  socket.addEventListener("error", () => finish(new Error("WebSocket connection failed")), { once: true });
  socket.addEventListener("message", ({ data }) => {
    try {
      assert.equal(JSON.parse(data).type, "welcome");
      finish();
    } catch (error) {
      finish(error);
    }
  }, { once: true });
});
console.log(`${websocketUrl}: welcome received`);
