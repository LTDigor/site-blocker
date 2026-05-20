import assert from "node:assert/strict";
import test from "node:test";

import { getCurrentSiteFromUrl, normalizeStoredRules, validateRuleInput } from "../../src/popup/validation.js";

test("accepts plain domains, paths, URLs, regex paths, localhost, and IDN domains", () => {
    const validRules = [
        ["example.com", "example.com"],
        ["example.com/news", "example.com/news"],
        ["https://openai.com/blog", "openai.com/blog"],
        ["example.com/^articles/[0-9]+", "example.com/^articles/[0-9]+"],
        ["localhost", "localhost"],
        ["ввв.рф", "ввв.рф"],
        ["https://пример.рф/news", "пример.рф/news"]
    ];

    for (const [rule, expectedValue] of validRules) {
        assert.deepEqual(validateRuleInput(rule), {
            isValid: true,
            value: expectedValue
        });
    }
});

test("trims valid input before returning it", () => {
    assert.deepEqual(validateRuleInput("  example.com  "), {
        isValid: true,
        value: "example.com"
    });
});

test("normalizes protocol and www prefix before saving", () => {
    assert.deepEqual(validateRuleInput("https://www.linkedin.com"), {
        isValid: true,
        value: "linkedin.com"
    });

    assert.deepEqual(validateRuleInput("http://www.linkedin.com/feed"), {
        isValid: true,
        value: "linkedin.com/feed"
    });
});

test("drops query strings and hashes before saving", () => {
    assert.deepEqual(validateRuleInput("https://www.linkedin.com?x=1#top"), {
        isValid: true,
        value: "linkedin.com"
    });

    assert.deepEqual(validateRuleInput("https://www.linkedin.com/feed?x=1#top"), {
        isValid: true,
        value: "linkedin.com/feed"
    });

    assert.deepEqual(validateRuleInput("example.com/news?x=1#top"), {
        isValid: true,
        value: "example.com/news"
    });
});

test("rejects empty input", () => {
    assert.deepEqual(validateRuleInput("   "), {
        isValid: false,
        message: "Enter a site or URL rule first."
    });
});

test("rejects rules with whitespace", () => {
    assert.deepEqual(validateRuleInput("example .com"), {
        isValid: false,
        message: "Rules cannot contain spaces."
    });
});

test("rejects unsupported protocols", () => {
    assert.deepEqual(validateRuleInput("ftp://example.com"), {
        isValid: false,
        message: "Only http and https URLs are supported."
    });
});

test("rejects invalid hostnames", () => {
    const invalidRules = [
        "not-a-url",
        "-example.com",
        "example-.com",
        "example..com"
    ];

    for (const rule of invalidRules) {
        assert.deepEqual(validateRuleInput(rule), {
            isValid: false,
            message: "Enter a valid domain or URL."
        });
    }
});

test("rejects invalid regex path rules", () => {
    assert.deepEqual(validateRuleInput("example.com/^["), {
        isValid: false,
        message: "Enter a valid regular expression rule."
    });
});

test("normalizes existing stored rules after extension updates", () => {
    assert.deepEqual(
        normalizeStoredRules([
            "https://www.linkedin.com",
            "linkedin.com",
            "https://www.linkedin.com/feed?x=1#top",
            "example.com/^[",
            "ftp://example.com",
            "ввв.рф"
        ]),
        [
            "linkedin.com",
            "linkedin.com/feed",
            "ввв.рф"
        ]
    );
});

test("extracts the current site from a regular tab URL", () => {
    assert.equal(getCurrentSiteFromUrl("https://www.linkedin.com/feed"), "linkedin.com");
    assert.equal(getCurrentSiteFromUrl("https://example.com/news?x=1#top"), "example.com");
    assert.equal(getCurrentSiteFromUrl("http://openai.com/"), "openai.com");
});

test("rejects non-web tab URLs for current-site capture", () => {
    assert.equal(getCurrentSiteFromUrl("chrome://extensions/"), null);
    assert.equal(getCurrentSiteFromUrl("about:blank"), null);
    assert.equal(getCurrentSiteFromUrl("not-a-url"), null);
});
