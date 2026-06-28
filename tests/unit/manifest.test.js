import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

test("manifest allows the blocked page to load in incognito tabs", async () => {
    const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));

    assert.equal(manifest.incognito, "split");
});

test("manifest exposes the blocked page and its default image to redirected pages", async () => {
    const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
    const resources = manifest.web_accessible_resources.flatMap((entry) => entry.resources);

    assert.ok(resources.includes("src/blocked/block.html"));
    assert.ok(resources.includes("assets/images/image.jpg"));
});

test("manifest allows stored images on extension pages", async () => {
    const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
    const extensionPagesPolicy = manifest.content_security_policy.extension_pages;

    assert.match(extensionPagesPolicy, /img-src[^;]*'self'/);
    assert.match(extensionPagesPolicy, /img-src[^;]*data:/);
    assert.match(extensionPagesPolicy, /img-src[^;]*blob:/);
});

test("manifest uses a valid Manifest V3 background declaration", async () => {
    const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));

    assert.equal(manifest.manifest_version, 3);
    assert.equal(manifest.background.service_worker, "src/background/background.js");
    assert.equal(manifest.background.scripts, undefined);
});

test("manifest declares the public single-purpose description", async () => {
    const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));

    assert.equal(
        manifest.description,
        "Block user-selected websites or URL paths and redirect them to a local block page."
    );
});
