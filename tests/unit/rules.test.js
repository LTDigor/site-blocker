import assert from "node:assert/strict";
import test from "node:test";

import {
    buildDeclarativeNetRequestRules,
    filterTemporarilyUnblockedRules,
    getNextTemporaryUnblockExpiry,
    matchesUrl,
    parseRule,
    parseRules,
    pruneExpiredTemporaryUnblocks
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

test("matches YouTube domain rules on common entry URLs", () => {
    const rules = [parseRule("youtube.com")];

    assert.equal(matchesUrl("https://youtube.com/", rules), true);
    assert.equal(matchesUrl("https://www.youtube.com/", rules), true);
    assert.equal(matchesUrl("https://m.youtube.com/shorts/abc123", rules), true);
    assert.equal(matchesUrl("https://music.youtube.com/watch?v=abc123", rules), true);
    assert.equal(matchesUrl("https://youtube-nocookie.com/embed/abc123", rules), false);
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
    ], "chrome-extension://test/blocked.html"), [
        {
            id: 1,
            priority: 1,
            action: {
                type: "redirect",
                redirect: {
                    regexSubstitution: "chrome-extension://test/blocked.html?blockedRule=example.com#\\0"
                }
            },
            condition: {
                regexFilter: "^https?://([^/?#]+\\.)?example\\.com(?::[0-9]+)?([/?#].*)?$",
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
                    regexSubstitution: "chrome-extension://test/blocked.html?blockedRule=example.com%2Fnews#\\0"
                }
            },
            condition: {
                regexFilter: "^https?://([^/?#]+\\.)?example\\.com(?::[0-9]+)?/news.*$",
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
                    regexSubstitution: "chrome-extension://test/blocked.html?blockedRule=example.com%2F%5Earticles%2F%5B0-9%5D%2B#\\0"
                }
            },
            condition: {
                regexFilter: "^https?://([^/?#]+\\.)?example\\.com(?::[0-9]+)?/articles\\/[0-9]+.*$",
                resourceTypes: ["main_frame"],
                isUrlFilterCaseSensitive: true
            }
        }
    ]);
});

test("generated declarativeNetRequest regexes preserve rule matching semantics", () => {
    const rawRules = [
        "example.com",
        "example.com/news",
        "example.com/^articles/[0-9]+"
    ];
    const generatedRules = buildDeclarativeNetRequestRules(rawRules, "chrome-extension://test/blocked.html");

    const cases = [
        ["example.com", "https://example.com", true],
        ["example.com", "https://example.com?x=1", true],
        ["example.com", "https://example.com/#section", true],
        ["example.com", "https://www.example.com/news?id=1", true],
        ["example.com", "https://notexample.com/", false],
        ["example.com/news", "https://example.com/news/article?id=1", true],
        ["example.com/news", "https://example.com/blog", false],
        ["example.com/^articles/[0-9]+", "https://example.com/articles/42#comments", true],
        ["example.com/^articles/[0-9]+", "https://example.com/articles/latest", false]
    ];

    for (const [rawRule, url, expected] of cases) {
        const generatedRule = generatedRules[rawRules.indexOf(rawRule)];
        const parsedRule = parseRule(rawRule);

        assert.equal(new RegExp(generatedRule.condition.regexFilter).test(url), expected);
        assert.equal(matchesUrl(url, [parsedRule]), expected);
    }
});

test("generated declarativeNetRequest substitution carries the full original URL", () => {
    const [rule] = buildDeclarativeNetRequestRules(
        ["example.com/news"],
        "chrome-extension://test/blocked.html"
    );
    const blockedUrl = "https://www.example.com/news/article?id=1#comments";
    const match = blockedUrl.match(new RegExp(rule.condition.regexFilter));
    const redirectedUrl = rule.action.redirect.regexSubstitution.replace("\\0", match[0]);

    assert.equal(
        redirectedUrl,
        "chrome-extension://test/blocked.html?blockedRule=example.com%2Fnews#https://www.example.com/news/article?id=1#comments"
    );
});

test("filters active temporary unblocks before building rules", () => {
    assert.deepEqual(
        filterTemporarilyUnblockedRules(
            ["example.com", "openai.com", "example.com/news"],
            {
                "example.com": 2000,
                "example.com/news": 999,
                "unknown.com": 2000
            },
            1000
        ),
        ["openai.com", "example.com/news"]
    );

    assert.deepEqual(
        buildDeclarativeNetRequestRules(
            ["example.com", "openai.com"],
            "chrome-extension://test/blocked.html",
            { "example.com": 2000 },
            1000
        ).map((rule) => rule.condition.regexFilter),
        ["^https?://([^/?#]+\\.)?openai\\.com(?::[0-9]+)?([/?#].*)?$"]
    );
});

test("prunes expired temporary unblocks and finds the next expiry", () => {
    const activeUnblocks = pruneExpiredTemporaryUnblocks({
        "example.com": 2000,
        "openai.com": 1000,
        "invalid.com": Number.NaN
    }, 1500);

    assert.deepEqual(activeUnblocks, {
        "example.com": 2000
    });
    assert.equal(getNextTemporaryUnblockExpiry(activeUnblocks, 1500), 2000);
    assert.equal(getNextTemporaryUnblockExpiry(activeUnblocks, 2500), null);
});
