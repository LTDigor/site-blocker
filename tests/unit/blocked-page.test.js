import assert from "node:assert/strict";
import test from "node:test";

test("blocked page shows the default image before storage resolves", async (t) => {
    let resolveStorage;
    let resolveStorageRequested;
    const storageRequested = new Promise((resolve) => {
        resolveStorageRequested = resolve;
    });
    const blockedImage = {};
    const { cleanup } = setupBlockedPageTest({
        blockedImage,
        storageGet() {
            resolveStorageRequested();
            return new Promise((resolve) => {
                resolveStorage = resolve;
            });
        }
    });
    t.after(cleanup);

    const importPromise = importBlockedPageScript();
    await storageRequested;

    assert.equal(blockedImage.src, "chrome-extension://test/assets/images/image.jpg");

    resolveStorage({});
    await importPromise;
});

test("blocked page preserves the default image URL resolved in its incognito context", async (t) => {
    const incognitoImageUrl = "chrome-extension://incognito-dynamic/assets/images/image.jpg";
    const blockedImage = { src: incognitoImageUrl };
    const { cleanup } = setupBlockedPageTest({
        blockedImage,
        runtimeImageUrl: "chrome-extension://regular-dynamic/assets/images/image.jpg",
        storageGet() {
            return Promise.resolve({});
        }
    });
    t.after(cleanup);

    await importBlockedPageScript();

    assert.equal(blockedImage.src, incognitoImageUrl);
});

test("blocked page uses a saved custom image when storage provides one", async (t) => {
    const blockedImage = {};
    const customImage = "data:image/png;base64,custom";
    const { cleanup } = setupBlockedPageTest({
        blockedImage,
        storageGet() {
            return Promise.resolve({
                blockedImageDataUrl: customImage
            });
        }
    });
    t.after(cleanup);

    await importBlockedPageScript();

    assert.equal(blockedImage.src, customImage);
});

test("blocked page keeps the default image when storage is unavailable", async (t) => {
    const blockedImage = {};
    const { cleanup } = setupBlockedPageTest({
        blockedImage,
        storageGet() {
            return Promise.reject(new Error("storage unavailable"));
        }
    });
    t.after(cleanup);

    await importBlockedPageScript();

    assert.equal(blockedImage.src, "chrome-extension://test/assets/images/image.jpg");
});

test("blocked page keeps the default image when storage returns no data", async (t) => {
    const blockedImage = {};
    const { cleanup } = setupBlockedPageTest({
        blockedImage,
        storageGet() {
            return Promise.resolve(undefined);
        }
    });
    t.after(cleanup);

    await importBlockedPageScript();

    assert.equal(blockedImage.src, "chrome-extension://test/assets/images/image.jpg");
});

test("blocked page falls back to the neutral default when a saved custom image is invalid", async (t) => {
    const blockedImage = {
        set src(value) {
            this.currentSrc = value;
            if (value.startsWith("data:image/invalid")) {
                this.onerror?.();
            }
        },
        get src() {
            return this.currentSrc;
        }
    };
    const { cleanup } = setupBlockedPageTest({
        blockedImage,
        storageGet() {
            return Promise.resolve({
                blockedImageDataUrl: "data:image/invalid"
            });
        }
    });
    t.after(cleanup);

    await importBlockedPageScript();

    assert.equal(blockedImage.src, "chrome-extension://test/assets/images/image.jpg");
});

test("blocked page reload opens original URL during active temporary unblock", async (t) => {
    const redirects = [];
    const originalUrl = "https://www.youtube.com/watch?v=abc123";
    const { cleanup } = setupBlockedPageTest({
        blockedImage: {},
        url: `chrome-extension://test/src/blocked/block.html?blockedRule=youtube.com#${originalUrl}`,
        redirects,
        storageGet() {
            return Promise.resolve({
                temporaryUnblocks: {
                    "youtube.com": Date.now() + 60000
                }
            });
        }
    });
    t.after(cleanup);

    await importBlockedPageScript();

    assert.deepEqual(redirects, [originalUrl]);
});

test("blocked page reload stays blocked after temporary unblock expires", async (t) => {
    const redirects = [];
    const originalUrl = "https://www.youtube.com/watch?v=abc123";
    const { cleanup } = setupBlockedPageTest({
        blockedImage: {},
        url: `chrome-extension://test/src/blocked/block.html?blockedRule=youtube.com#${originalUrl}`,
        redirects,
        storageGet() {
            return Promise.resolve({
                temporaryUnblocks: {
                    "youtube.com": Date.now() - 60000
                }
            });
        }
    });
    t.after(cleanup);

    await importBlockedPageScript();

    assert.deepEqual(redirects, []);
});

test("blocked page reload ignores unsafe original URL context", async (t) => {
    const redirects = [];
    const { cleanup } = setupBlockedPageTest({
        blockedImage: {},
        url: "chrome-extension://test/src/blocked/block.html?blockedRule=youtube.com#javascript:alert(1)",
        redirects,
        storageGet() {
            return Promise.resolve({
                temporaryUnblocks: {
                    "youtube.com": Date.now() + 60000
                }
            });
        }
    });
    t.after(cleanup);

    await importBlockedPageScript();

    assert.deepEqual(redirects, []);
});

test("blocked page reload refuses mismatched original URL context", async (t) => {
    const redirects = [];
    const { cleanup } = setupBlockedPageTest({
        blockedImage: {},
        url: "chrome-extension://test/src/blocked/block.html?blockedRule=youtube.com#https://attacker.test/phish",
        redirects,
        storageGet() {
            return Promise.resolve({
                temporaryUnblocks: {
                    "youtube.com": Date.now() + 60000
                }
            });
        }
    });
    t.after(cleanup);

    await importBlockedPageScript();

    assert.deepEqual(redirects, []);
});

function setupBlockedPageTest({
    blockedImage,
    storageGet,
    url,
    redirects = [],
    runtimeImageUrl = "chrome-extension://test/assets/images/image.jpg"
}) {
    const previousBrowser = globalThis.browser;
    const previousChrome = globalThis.chrome;
    const previousDocument = globalThis.document;
    const previousLocation = globalThis.location;

    if (!blockedImage.src) {
        blockedImage.src = runtimeImageUrl;
    }

    globalThis.browser = {
        runtime: {
            getURL(path) {
                assert.equal(path, "assets/images/image.jpg");
                return runtimeImageUrl;
            }
        },
        storage: {
            local: {
                get: storageGet
            }
        }
    };
    globalThis.chrome = undefined;
    globalThis.document = {
        getElementById(id) {
            assert.equal(id, "blockedImage");
            return blockedImage;
        }
    };
    globalThis.location = {
        href: url || "chrome-extension://test/src/blocked/block.html",
        replace(nextUrl) {
            redirects.push(nextUrl);
        }
    };

    return {
        cleanup() {
            globalThis.browser = previousBrowser;
            globalThis.chrome = previousChrome;
            globalThis.document = previousDocument;
            globalThis.location = previousLocation;
        }
    };
}

function importBlockedPageScript() {
    return import(`../../src/blocked/blocked.js?test=${Date.now()}-${Math.random()}`);
}
