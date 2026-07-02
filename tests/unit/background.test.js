import assert from "node:assert/strict";
import test from "node:test";

test("background installs dynamic redirect rules that preserve the original URL", async (t) => {
    const previousChrome = globalThis.chrome;
    const previousBrowser = globalThis.browser;
    const chrome = createChromeMock({
        blockedSites: ["example.com/news"],
        temporaryUnblocks: {}
    });

    globalThis.browser = undefined;
    globalThis.chrome = chrome;
    t.after(() => {
        globalThis.chrome = previousChrome;
        globalThis.browser = previousBrowser;
    });

    await import(`../../src/background/background.js?test=${Date.now()}-${Math.random()}`);
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(chrome.declarativeNetRequest.updatedRules.length, 1);
    assert.deepEqual(chrome.declarativeNetRequest.updatedRules[0].action, {
        type: "redirect",
        redirect: {
            regexSubstitution: "chrome-extension://test/src/blocked/block.html?blockedRule=example.com%2Fnews#\\0"
        }
    });
    assert.equal(
        chrome.declarativeNetRequest.updatedRules[0].condition.regexFilter,
        "^https?://([^/?#]+\\.)?example\\.com(?::[0-9]+)?/news.*$"
    );
    assert.equal(chrome.declarativeNetRequest.lastRegexSupportCheck.isCaseSensitive, false);
});

function createChromeMock(state) {
    return {
        runtime: {
            getURL(path) {
                return `chrome-extension://test/${path}`;
            },
            onInstalled: createEventMock(),
            onStartup: createEventMock()
        },
        alarms: {
            onAlarm: createEventMock(),
            clear(name, callback) {
                this.cleared = name;
                callback?.(true);
            },
            create(name, alarmInfo) {
                this.created = { name, alarmInfo };
            }
        },
        storage: {
            local: {
                get(keys, callback) {
                    callback(Object.fromEntries(keys.map((key) => [key, state[key]])));
                },
                set(nextState, callback) {
                    Object.assign(state, nextState);
                    callback?.();
                }
            },
            onChanged: createEventMock()
        },
        declarativeNetRequest: {
            updatedRules: [],
            getDynamicRules(callback) {
                callback([]);
            },
            updateDynamicRules(options, callback) {
                this.updatedRules = options.addRules;
                this.lastUpdateOptions = options;
                callback?.();
            },
            isRegexSupported(options, callback) {
                this.lastRegexSupportCheck = options;
                callback({ isSupported: true });
            }
        }
    };
}

function createEventMock() {
    return {
        listeners: [],
        addListener(listener) {
            this.listeners.push(listener);
        }
    };
}
