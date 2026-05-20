import assert from "node:assert/strict";
import test from "node:test";

import {
    buildDeclarativeNetRequestRules,
    matchesUrl,
    parseRule,
    parseRules
} from "../../src/background/rules.js";

test("parses domain rules", () => {
    assert.deepEqual(parseRule("example.com"), {
        domain: "example.com",
        type: "domain"
    });
});

test("parses path prefix rules", () => {
    assert.deepEqual(parseRule("example.com/news"), {
        domain: "example.com",
        type: "path",
        path: "news"
    });
});

test("parses regex path rules", () => {
    const rule = parseRule("example.com/^articles/[0-9]+");

    assert.equal(rule.domain, "example.com");
    assert.equal(rule.type, "regex");
    assert.ok(rule.regex instanceof RegExp);
    assert.equal(rule.regex.source, "^articles\\/[0-9]+");
});

test("normalizes IDN domains to punycode", () => {
    assert.deepEqual(parseRule("ввв.рф"), {
        domain: "xn--b1aaa.xn--p1ai",
        type: "domain"
    });
});

test("normalizes old persisted URL-shaped rules", () => {
    assert.deepEqual(parseRule("https://www.linkedin.com"), {
        domain: "linkedin.com",
        type: "domain"
    });

    assert.deepEqual(parseRule("https://www.linkedin.com/feed?x=1#top"), {
        domain: "linkedin.com",
        type: "path",
        path: "feed"
    });
});

test("normalizes unicode path prefixes to match browser URL path encoding", () => {
    const rules = [parseRule("example.com/café")];

    assert.deepEqual(rules[0], {
        domain: "example.com",
        type: "path",
        path: "caf%C3%A9"
    });
    assert.equal(matchesUrl("https://example.com/caf%C3%A9", rules), true);
});

test("matches whole domains and subdomains", () => {
    const rules = [parseRule("example.com")];

    assert.equal(matchesUrl("https://example.com/", rules), true);
    assert.equal(matchesUrl("https://www.example.com/", rules), true);
    assert.equal(matchesUrl("https://notexample.com/", rules), false);
});

test("matches path prefixes", () => {
    const rules = [parseRule("example.com/news")];

    assert.equal(matchesUrl("https://example.com/news/today", rules), true);
    assert.equal(matchesUrl("https://example.com/blog", rules), false);
});

test("matches regex paths", () => {
    const rules = [parseRule("example.com/^articles/[0-9]+")];

    assert.equal(matchesUrl("https://example.com/articles/42", rules), true);
    assert.equal(matchesUrl("https://example.com/articles/latest", rules), false);
});

test("matches IDN domains", () => {
    const rules = [parseRule("ввв.рф")];

    assert.equal(matchesUrl("https://ввв.рф/", rules), true);
    assert.equal(matchesUrl("https://пример.рф/", rules), false);
});

test("skips invalid persisted rules", () => {
    assert.deepEqual(parseRules([
        "example.com",
        "example.com/^[",
        "https://user:pass@example.com/private",
        "example.com:8443/admin",
        "openai.com"
    ]), [
        {
            domain: "example.com",
            type: "domain"
        },
        {
            domain: "openai.com",
            type: "domain"
        }
    ]);
});

test("builds declarativeNetRequest redirect rules", () => {
    assert.deepEqual(buildDeclarativeNetRequestRules([
        "example.com",
        "example.com/news",
        "example.com/^articles/[0-9]+"
    ], "/blocked.html"), [
        {
            id: 1,
            priority: 1,
            action: {
                type: "redirect",
                redirect: {
                    extensionPath: "/blocked.html"
                }
            },
            condition: {
                urlFilter: "||example.com^",
                resourceTypes: ["main_frame"],
                isUrlFilterCaseSensitive: true
            }
        },
        {
            id: 2,
            priority: 1,
            action: {
                type: "redirect",
                redirect: {
                    extensionPath: "/blocked.html"
                }
            },
            condition: {
                regexFilter: "^https?://([^/?#]+\\.)?example\\.com(?::[0-9]+)?/news",
                resourceTypes: ["main_frame"],
                isUrlFilterCaseSensitive: true
            }
        },
        {
            id: 3,
            priority: 1,
            action: {
                type: "redirect",
                redirect: {
                    extensionPath: "/blocked.html"
                }
            },
            condition: {
                regexFilter: "^https?://([^/?#]+\\.)?example\\.com(?::[0-9]+)?/articles\\/[0-9]+",
                resourceTypes: ["main_frame"],
                isUrlFilterCaseSensitive: true
            }
        }
    ]);
});
