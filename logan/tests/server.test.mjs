import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, cp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";
import { spawn } from "node:child_process";
const root = fileURLToPath(new URL("../", import.meta.url));
async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
test(
  "packaged server assets, reversible events, import guard, and missing static response",
  { timeout: 30000 },
  async () => {
    const temporary = await mkdtemp(join(tmpdir(), "needle-logan-test-"));
    let child;
    try {
      for (const name of [
        "server.mjs",
        "algorithm.mjs",
        "sample.mjs",
        "public",
      ])
        await cp(join(root, name), join(temporary, name), { recursive: true });
      const port = await availablePort();
      child = spawn(process.execPath, [join(temporary, "server.mjs")], {
        env: {
          LOGAN_PORT: String(port),
          LOGAN_DATA_DIR: join(temporary, "data"),
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(Error("server did not start")),
          10000,
        );
        child.stdout.once("data", () => {
          clearTimeout(timer);
          resolve();
        });
        child.once("error", reject);
        child.once("exit", (code) => {
          clearTimeout(timer);
          reject(Error(`server exited ${code}`));
        });
      });
      const base = `http://127.0.0.1:${port}`;
      const post = (path, body) =>
        fetch(base + path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      for (const asset of ["headphones", "chair", "tent", "laptop"]) {
        const response = await fetch(`${base}/assets/${asset}.svg`);
        assert.equal(response.status, 200);
        assert.match(await response.text(), /<svg/);
      }
      const state = await (await fetch(base + "/api/state")).json();
      const event = {
        recordId: state.records[0].id,
        action: "group_interest",
        attribute: "convenience",
      };
      await post("/api/events", event);
      await post("/api/events", event);
      assert.equal(
        (await (await fetch(base + "/api/insights")).json()).totalSignals,
        1,
      );
      await post("/api/events", { ...event, remove: true });
      assert.equal(
        (await (await fetch(base + "/api/insights")).json()).totalSignals,
        0,
      );
      assert.equal((await post("/api/import", { records: [] })).status, 401);
      await rm(join(temporary, "public", "app.js"));
      const missing = await fetch(base + "/app.js");
      assert.equal(missing.status, 404);
      assert.equal((await missing.json()).error, "ASSET_NOT_FOUND");
      assert.equal((await fetch(base + "/api/state")).status, 200);
      assert.equal((await fetch(base + "/not-allowlisted")).status, 404);
      assert.equal(
        (
          await fetch(base + "/api/state", {
            headers: { Origin: "https://example.com" },
          })
        ).status,
        403,
      );
      const persisted = JSON.parse(
        await readFile(join(temporary, "data", "workspace.json"), "utf8"),
      );
      assert.equal(persisted.events.length, 0);
    } finally {
      if (child && child.exitCode === null) {
        child.kill();
        await new Promise((resolve) => child.once("exit", resolve));
      }
      await rm(temporary, { recursive: true, force: true });
    }
  },
);
