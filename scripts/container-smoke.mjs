import assert from "node:assert/strict";

const base = process.argv[2] || "http://127.0.0.1:8080";
const health = await fetch(`${base}/api/health`);
assert.equal(health.status, 200);
assert.deepEqual(await health.json(), { ok: true });

const page = await fetch(base);
assert.equal(page.status, 200);
const html = await page.text();
assert.match(html, /<title>澄言/);
const assetPaths = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(
  (match) => match[1],
);
assert.ok(assetPaths.length >= 2, "The built page must contain JS and CSS assets");
for (const assetPath of assetPaths) {
  const response = await fetch(`${base}${assetPath}`);
  assert.equal(response.status, 200, `Failed to serve ${assetPath}`);
  assert.ok((await response.arrayBuffer()).byteLength > 0);
}

const badRequest = await fetch(`${base}/api/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({ baseUrl: "file:///invalid" }),
});
assert.equal(badRequest.status, 400, "The container must expose the API proxy");
assert.equal(typeof (await badRequest.json()).error.message, "string");

console.log("Container smoke passed: health, homepage, JS/CSS assets and API validation");
