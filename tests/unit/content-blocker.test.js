import assert from "node:assert/strict";
import test from "node:test";

test("content fallback redirects blocked YouTube pages", async (t) => {
    const state = {
        blockedSites: ["youtube.com"]
    };
    const redirects = [];
    const { cleanup } = await setupContentScriptTest({
        state,
        url: "https://www.youtube.com/watch?v=abc123",
        redirects
    });
    t.after(cleanup);

    await import(`../../src/content/blocker.js?test=${Date.now()}-${Math.random()}`);
    await Promise.resolve();

    assert.deepEqual(redirects, [
        "chrome-extension://test/src/blocked/block.html?blockedRule=youtube.com#https://www.youtube.com/watch?v=abc123"
    ]);
});

test("content fallback ignores unblocked pages", async (t) => {
    const redirects = [];
    const { cleanup } = await setupContentScriptTest({
        state: {
            blockedSites: ["youtube.com"]
        },
        url: "https://example.com/",
        redirects
    });
    t.after(cleanup);

    await import(`../../src/content/blocker.js?test=${Date.now()}-${Math.random()}`);
    await Promise.resolve();

    assert.deepEqual(redirects, []);
});

test("content fallback ignores YouTube Chrome auth pages", async (t) => {
    const redirects = [];

    await setupContentScriptTest({
        state: {
            blockedSites: ["youtube.com"]
        },
        url: "https://accounts.youtube.com/accounts/SetSID",
        redirects
    });

    await import(`../../src/content/blocker.js?test=${Date.now()}-${Math.random()}`);

    assert.deepEqual(redirects, []);
});

test("content fallback respects active temporary unblocks", async (t) => {
    const redirects = [];
    const { cleanup } = await setupContentScriptTest({
        state: {
            blockedSites: ["youtube.com"],
            temporaryUnblocks: {
                "youtube.com": Date.now() + 60000
            }
        },
        url: "https://www.youtube.com/watch?v=abc123",
        redirects
    });
    t.after(cleanup);

    await import(`../../src/content/blocker.js?test=${Date.now()}-${Math.random()}`);
    await Promise.resolve();

    assert.deepEqual(redirects, []);
});

test("content fallback ignores expired temporary unblocks", async (t) => {
    const redirects = [];
    const { cleanup } = await setupContentScriptTest({
        state: {
            blockedSites: ["youtube.com"],
            temporaryUnblocks: {
                "youtube.com": Date.now() - 60000
            }
        },
        url: "https://www.youtube.com/watch?v=abc123",
        redirects
    });
    t.after(cleanup);

    await import(`../../src/content/blocker.js?test=${Date.now()}-${Math.random()}`);
    await Promise.resolve();

    assert.deepEqual(redirects, [
        "chrome-extension://test/src/blocked/block.html?blockedRule=youtube.com#https://www.youtube.com/watch?v=abc123"
    ]);
});

test("content fallback redirects when a temporary unblock is removed", async (t) => {
    const redirects = [];
    const chrome = createChromeMock({
        blockedSites: ["youtube.com"],
        temporaryUnblocks: {}
    });
    const { cleanup } = await setupContentScriptTest({
        chrome,
        url: "https://www.youtube.com/watch?v=abc123",
        redirects
    });
    t.after(cleanup);

    await import(`../../src/content/blocker.js?test=${Date.now()}-${Math.random()}`);
    chrome.storage.onChanged.listener({
        temporaryUnblocks: {
            oldValue: { "youtube.com": Date.now() + 60000 },
            newValue: {}
        }
    }, "local");
    await Promise.resolve();

    assert.deepEqual(redirects, [
        "chrome-extension://test/src/blocked/block.html?blockedRule=youtube.com#https://www.youtube.com/watch?v=abc123",
        "chrome-extension://test/src/blocked/block.html?blockedRule=youtube.com#https://www.youtube.com/watch?v=abc123"
    ]);
});

async function setupContentScriptTest({ state, chrome, url, redirects }) {
    const previousBrowser = globalThis.browser;
    const previousChrome = globalThis.chrome;
    const previousLocation = globalThis.location;

    globalThis.browser = undefined;
    globalThis.chrome = chrome || createChromeMock(state);
    globalThis.location = {
        href: url,
        replace(nextUrl) {
            redirects.push(nextUrl);
        }
    };

    return {
        cleanup() {
            globalThis.browser = previousBrowser;
            globalThis.chrome = previousChrome;
            globalThis.location = previousLocation;
        }
    };
}

function createChromeMock(state) {
    return {
        runtime: {
            getURL(path) {
                return `chrome-extension://test/${path}`;
            }
        },
        storage: {
            local: {
                get(keys, callback) {
                    callback(Object.fromEntries(keys.map((key) => [key, state[key]])));
                }
            },
            onChanged: {
                addListener(listener) {
                    this.listener = listener;
                }
            }
        }
    };
}
