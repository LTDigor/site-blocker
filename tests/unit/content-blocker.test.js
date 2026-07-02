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

    const { cleanup } = await setupContentScriptTest({
        state: {
            blockedSites: ["youtube.com"]
        },
        url: "https://accounts.youtube.com/accounts/SetSID",
        redirects
    });
    t.after(cleanup);

    await import(`../../src/content/blocker.js?test=${Date.now()}-${Math.random()}`);
    await Promise.resolve();

    assert.deepEqual(redirects, []);
});

test("content fallback stops polling when Chrome storage reports lastError", async (t) => {
    const redirects = [];
    const chrome = createChromeMock({
        blockedSites: ["linkedin.com/feed"]
    });
    chrome.storage.local.get = (keys, callback) => {
        chrome.runtime.lastError = { message: "Extension context invalidated." };
        callback(Object.fromEntries(keys.map((key) => [key, chrome.state[key]])));
        delete chrome.runtime.lastError;
    };
    const { cleanup, clearedIntervals } = await setupContentScriptTest({
        chrome,
        url: "https://www.linkedin.com/feed/",
        redirects
    });
    t.after(cleanup);

    await import(`../../src/content/blocker.js?test=${Date.now()}-${Math.random()}`);
    await Promise.resolve();

    assert.deepEqual(clearedIntervals, [1]);
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

test("content fallback redirects after same-page route changes", async (t) => {
    const redirects = [];
    const { cleanup, location, runIntervals } = await setupContentScriptTest({
        state: {
            blockedSites: ["linkedin.com/feed"]
        },
        url: "https://www.linkedin.com/jobs/",
        redirects
    });
    t.after(cleanup);

    await import(`../../src/content/blocker.js?test=${Date.now()}-${Math.random()}`);
    await Promise.resolve();

    assert.deepEqual(redirects, []);

    location.href = "https://www.linkedin.com/feed/";
    runIntervals();
    await Promise.resolve();

    assert.deepEqual(redirects, [
        "chrome-extension://test/src/blocked/block.html?blockedRule=linkedin.com%2Ffeed#https://www.linkedin.com/feed/"
    ]);
});

test("content fallback stops polling when extension context is invalidated", async (t) => {
    const redirects = [];
    let storageReads = 0;
    const chrome = createChromeMock({
        blockedSites: ["linkedin.com/feed"]
    });
    chrome.storage.local.get = (keys, callback) => {
        storageReads += 1;

        if (storageReads > 1) {
            throw new Error("Extension context invalidated.");
        }

        callback(Object.fromEntries(keys.map((key) => [key, chrome.state[key]])));
    };
    const { cleanup, location, runIntervals, clearedIntervals } = await setupContentScriptTest({
        chrome,
        url: "https://www.linkedin.com/jobs/",
        redirects
    });
    t.after(cleanup);

    await import(`../../src/content/blocker.js?test=${Date.now()}-${Math.random()}`);
    await Promise.resolve();

    location.href = "https://www.linkedin.com/feed/";

    assert.doesNotThrow(() => runIntervals());
    assert.deepEqual(clearedIntervals, [1]);
    assert.deepEqual(redirects, []);
});

test("content fallback stops polling when browser storage rejects after invalidation", async (t) => {
    const redirects = [];
    let storageReads = 0;
    const browser = createBrowserMock({
        blockedSites: ["mail.google.com/mail"]
    });
    browser.storage.local.get = async (keys) => {
        storageReads += 1;

        if (storageReads > 1) {
            throw new Error("Extension context invalidated.");
        }

        return Object.fromEntries(keys.map((key) => [key, browser.state[key]]));
    };
    const { cleanup, location, runIntervals, clearedIntervals } = await setupContentScriptTest({
        browser,
        url: "https://mail.google.com/calendar/",
        redirects
    });
    t.after(cleanup);

    await import(`../../src/content/blocker.js?test=${Date.now()}-${Math.random()}`);
    await Promise.resolve();

    location.href = "https://mail.google.com/mail/u/0/#inbox";
    runIntervals();
    await Promise.resolve();
    await Promise.resolve();

    assert.deepEqual(clearedIntervals, [1]);
    assert.deepEqual(redirects, []);
});

async function setupContentScriptTest({ state, chrome, browser, url, redirects }) {
    const previousBrowser = globalThis.browser;
    const previousChrome = globalThis.chrome;
    const previousLocation = globalThis.location;
    const previousSetInterval = globalThis.setInterval;
    const previousClearInterval = globalThis.clearInterval;
    const intervalCallbacks = [];
    const clearedIntervals = [];

    globalThis.browser = browser;
    globalThis.chrome = chrome || createChromeMock(state);
    globalThis.location = {
        href: url,
        replace(nextUrl) {
            redirects.push(nextUrl);
        }
    };
    globalThis.setInterval = (callback) => {
        intervalCallbacks.push(callback);
        return intervalCallbacks.length;
    };
    globalThis.clearInterval = (intervalId) => {
        clearedIntervals.push(intervalId);
    };

    return {
        clearedIntervals,
        location: globalThis.location,
        runIntervals() {
            for (const callback of intervalCallbacks) {
                callback();
            }
        },
        cleanup() {
            globalThis.browser = previousBrowser;
            globalThis.chrome = previousChrome;
            globalThis.location = previousLocation;
            globalThis.setInterval = previousSetInterval;
            globalThis.clearInterval = previousClearInterval;
        }
    };
}

function createChromeMock(state) {
    return {
        state,
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

function createBrowserMock(state) {
    return {
        state,
        runtime: {
            getURL(path) {
                return `chrome-extension://test/${path}`;
            }
        },
        storage: {
            local: {
                async get(keys) {
                    return Object.fromEntries(keys.map((key) => [key, state[key]]));
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
