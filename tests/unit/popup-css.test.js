import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("popup keeps a fixed height without stretching the image section", async () => {
    const css = await readFile(new URL("../../src/popup/popup.css", import.meta.url), "utf8");
    const bodyRule = getRule(css, "body");

    assert.match(bodyRule, /(^|\n)\s*height:\s*560px;/);
    assert.match(bodyRule, /(^|\n)\s*overflow:\s*hidden;/);
    assert.match(css, /\.popup-shell\s*{[^}]*\bheight:\s*100vh;/s);
    assert.match(
        css,
        /\.popup-shell:has\(\.current-block-section\.is-hidden\)\s*{[^}]*grid-template-rows:\s*auto auto minmax\(0,\s*1fr\) auto;/s,
        "the hidden current-site section must not shift the image section into the flexible grid row",
    );
    assert.match(css, /\.rules-section\s*{[^}]*\bmin-height:\s*0;/s);
    assert.match(css, /\.rules-content\s*{[^}]*\boverflow-y:\s*auto;/s);
});

test("collapsed rules use content-sized grid rows", async () => {
    const css = await readFile(new URL("../../src/popup/popup.css", import.meta.url), "utf8");

    assert.match(
        css,
        /\.popup-shell:has\(\.rules-section\.is-collapsed\)\s*{[^}]*grid-template-rows:\s*repeat\(5,\s*auto\);[^}]*align-content:\s*start;/s,
        "collapsed rules must not keep the flexible grid row",
    );
    assert.match(
        css,
        /\.popup-shell:has\(\.current-block-section\.is-hidden\):has\(\.rules-section\.is-collapsed\)\s*{[^}]*grid-template-rows:\s*repeat\(4,\s*auto\);/s,
        "the hidden current-site card must also be removed from the collapsed layout",
    );
});

function getRule(css, selector) {
    const match = css.match(new RegExp(`${selector}\\s*{([^}]*)}`));

    assert.ok(match, `Missing ${selector} rule`);
    return match[1];
}
