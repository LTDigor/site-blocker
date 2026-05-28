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

    assert.deepEqual(redirects, ["chrome-extension://test/src/blocked/block.html"]);
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

async function setupContentScriptTest({ state, url, redirects }) {
    const previousBrowser = globalThis.browser;
    const previousChrome = globalThis.chrome;
    const previousLocation = globalThis.location;

    globalThis.browser = undefined;
    globalThis.chrome = createChromeMock(state);
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
                addListener() {}
            }
        }
    };
}
