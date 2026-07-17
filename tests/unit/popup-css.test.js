import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("popup keeps a fixed height and scrolls expanded rules internally", async () => {
    const css = await readFile(new URL("../../src/popup/popup.css", import.meta.url), "utf8");
    const bodyRule = getRule(css, "body");

    assert.match(bodyRule, /(^|\n)\s*height:\s*560px;/);
    assert.match(bodyRule, /(^|\n)\s*overflow:\s*hidden;/);
    assert.match(css, /\.popup-shell\s*{[^}]*\bheight:\s*100vh;/s);
    assert.match(css, /\.rules-section\s*{[^}]*\bmin-height:\s*0;/s);
    assert.match(css, /\.rules-content\s*{[^}]*\boverflow-y:\s*auto;/s);
});

function getRule(css, selector) {
    const match = css.match(new RegExp(`${selector}\\s*{([^}]*)}`));

    assert.ok(match, `Missing ${selector} rule`);
    return match[1];
}
