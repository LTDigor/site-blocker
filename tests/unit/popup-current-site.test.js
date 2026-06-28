import assert from "node:assert/strict";
import test from "node:test";

test("adding the current site saves it and opens the block page immediately", async (t) => {
    const { elements, chrome, state, cleanup } = await setupPopupTest({
        activeTab: {
            id: 42,
            url: "https://www.example.com/news"
        }
    });
    t.after(cleanup);

    await elements.currentSiteBtn.onclick();

    assert.deepEqual(state.blockedSites, ["example.com"]);
    assert.equal(elements.siteInput.value, "");
    assert.equal(elements.formHint.textContent, "Current site added.");
    assert.deepEqual(chrome.tabs.updatedTabs, [
        {
            tabId: 42,
            options: {
                url: "chrome-extension://test/src/blocked/block.html?blockedRule=example.com#https://www.example.com/news"
            }
        }
    ]);
});

test("adding an already blocked current site still opens the block page", async (t) => {
    const { elements, chrome, state, cleanup } = await setupPopupTest({
        activeTab: {
            id: 42,
            url: "https://example.com/news"
        },
        initialState: {
            blockedSites: ["example.com"]
        }
    });
    t.after(cleanup);

    await elements.currentSiteBtn.onclick();

    assert.deepEqual(state.blockedSites, ["example.com"]);
    assert.equal(elements.siteInput.value, "example.com");
    assert.equal(elements.formHint.textContent, "This site is already in the list.");
    assert.equal(elements.formHint.classList.has("is-error"), true);
    assert.deepEqual(chrome.tabs.updatedTabs, [
        {
            tabId: 42,
            options: {
                url: "chrome-extension://test/src/blocked/block.html?blockedRule=example.com#https://example.com/news"
            }
        }
    ]);
});

test("blocked sites starts collapsed and expands when clicked", async (t) => {
    const { elements, cleanup } = await setupPopupTest({
        activeTab: {
            id: 42,
            url: "https://example.com/news"
        },
        initialState: {
            blockedSites: ["example.com", "openai.com"]
        }
    });
    t.after(cleanup);

    assert.equal(elements.rulesContent.hidden, true);
    assert.equal(elements.rulesToggle["aria-expanded"], "false");
    assert.equal(elements.rulesSection.classList.has("is-collapsed"), true);

    elements.rulesToggle.onclick();

    assert.equal(elements.rulesContent.hidden, false);
    assert.equal(elements.rulesToggle["aria-expanded"], "true");
    assert.equal(elements.rulesSection.classList.has("is-collapsed"), false);

    elements.rulesToggle.onclick();

    assert.equal(elements.rulesContent.hidden, true);
    assert.equal(elements.rulesToggle["aria-expanded"], "false");
    assert.equal(elements.rulesSection.classList.has("is-collapsed"), true);
});

test("temporarily unblocking a blocked site confirms with block image preview", async (t) => {
    const now = 1_700_000_000_000;
    const { elements, chrome, state, cleanup } = await setupPopupTest({
        activeTab: {
            id: 42,
            url: "chrome-extension://test/src/blocked/block.html?blockedRule=example.com#https://example.com/watch?v=abc123"
        },
        initialState: {
            blockedSites: ["example.com", "openai.com"],
            blockedImageDataUrl: "data:image/png;base64,custom"
        },
        now
    });
    t.after(cleanup);

    const unblockButton = elements.currentUnblockBtn;
    unblockButton.onclick();
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(elements.unblockDialog.open, true);
    assert.equal(elements.unblockPreview.src, "data:image/png;base64,custom");
    assert.equal(elements.unblockDialogText.textContent, "example.com will be available for 10 minutes.");
    answerCurrentChallenge(elements);

    await elements.confirmUnblockBtn.onclick();

    assert.deepEqual(state.blockedSites, ["example.com", "openai.com"]);
    assert.deepEqual(state.temporaryUnblocks, {
        "example.com": now + 10 * 60 * 1000
    });
    assert.notEqual(elements.formHint.textContent, "example.com unblocked for 10 minutes.");
    assert.equal(elements.unblockDialog.open, false);
    assert.equal(elements.currentBlockStatus.textContent.startsWith("Unblocked until "), true);
    assert.deepEqual(chrome.tabs.updatedTabs, [
        {
            tabId: 42,
            options: {
                url: "https://example.com/watch?v=abc123"
            }
        }
    ]);
});

test("temporarily unblocking falls back to the rule URL without original block page context", async (t) => {
    const now = 1_700_000_000_000;
    const { elements, chrome, cleanup } = await setupPopupTest({
        activeTab: {
            id: 42,
            url: "chrome-extension://test/src/blocked/block.html?blockedRule=example.com"
        },
        initialState: {
            blockedSites: ["example.com"]
        },
        now
    });
    t.after(cleanup);

    elements.currentUnblockBtn.onclick();
    await Promise.resolve();
    await Promise.resolve();
    answerCurrentChallenge(elements);
    await elements.confirmUnblockBtn.onclick();

    assert.deepEqual(chrome.tabs.updatedTabs, [
        {
            tabId: 42,
            options: {
                url: "https://example.com/"
            }
        }
    ]);
});

test("temporarily unblocking ignores unsafe original block page context", async (t) => {
    const now = 1_700_000_000_000;
    const { elements, chrome, cleanup } = await setupPopupTest({
        activeTab: {
            id: 42,
            url: "chrome-extension://test/src/blocked/block.html?blockedRule=example.com#javascript:alert(1)"
        },
        initialState: {
            blockedSites: ["example.com"]
        },
        now
    });
    t.after(cleanup);

    elements.currentUnblockBtn.onclick();
    await Promise.resolve();
    await Promise.resolve();
    answerCurrentChallenge(elements);
    await elements.confirmUnblockBtn.onclick();

    assert.deepEqual(chrome.tabs.updatedTabs, [
        {
            tabId: 42,
            options: {
                url: "https://example.com/"
            }
        }
    ]);
});

test("temporarily unblocking preserves original URL hashes", async (t) => {
    const now = 1_700_000_000_000;
    const { elements, chrome, cleanup } = await setupPopupTest({
        activeTab: {
            id: 42,
            url: "chrome-extension://test/src/blocked/block.html?blockedRule=example.com#https://example.com/watch?v=1#comments"
        },
        initialState: {
            blockedSites: ["example.com"]
        },
        now
    });
    t.after(cleanup);

    elements.currentUnblockBtn.onclick();
    await Promise.resolve();
    await Promise.resolve();
    answerCurrentChallenge(elements);
    await elements.confirmUnblockBtn.onclick();

    assert.deepEqual(chrome.tabs.updatedTabs, [
        {
            tabId: 42,
            options: {
                url: "https://example.com/watch?v=1#comments"
            }
        }
    ]);
});

test("temporarily unblocking path-specific rules restores the exact original URL", async (t) => {
    const now = 1_700_000_000_000;
    const { elements, chrome, cleanup } = await setupPopupTest({
        activeTab: {
            id: 42,
            url: "chrome-extension://test/src/blocked/block.html?blockedRule=example.com%2Fnews#https://example.com/news/article?id=1"
        },
        initialState: {
            blockedSites: ["example.com/news"]
        },
        now
    });
    t.after(cleanup);

    elements.currentUnblockBtn.onclick();
    await Promise.resolve();
    await Promise.resolve();
    answerCurrentChallenge(elements);
    await elements.confirmUnblockBtn.onclick();

    assert.deepEqual(chrome.tabs.updatedTabs, [
        {
            tabId: 42,
            options: {
                url: "https://example.com/news/article?id=1"
            }
        }
    ]);
});

test("popup on a blocked page only shows the currently blocked site as unblockable", async (t) => {
    const { elements, cleanup } = await setupPopupTest({
        activeTab: {
            id: 42,
            url: "chrome-extension://test/src/blocked/block.html?blockedRule=openai.com"
        },
        initialState: {
            blockedSites: ["example.com", "openai.com"]
        }
    });
    t.after(cleanup);

    assert.equal(elements.rulesContent.hidden, false);
    assert.equal(elements.counter.textContent, 2);
    assert.equal(elements.list.children.length, 2);
    assert.equal(elements.currentBlockSection.classList.has("is-hidden"), false);
    assert.equal(elements.currentBlockSite.textContent, "openai.com");
    assert.equal(elements.currentUnblockBtn.textContent, "Unblock 10 min");
});

test("popup ignores non-extension pages that look like the block page", async (t) => {
    const { elements, cleanup } = await setupPopupTest({
        activeTab: {
            id: 42,
            url: "https://attacker.test/src/blocked/block.html?blockedRule=openai.com"
        },
        initialState: {
            blockedSites: ["example.com", "openai.com"]
        }
    });
    t.after(cleanup);

    assert.equal(elements.rulesContent.hidden, true);
    assert.equal(elements.currentBlockSection.classList.has("is-hidden"), true);
});

test("popup shows unblock action when only one blocked site exists without blocked page context", async (t) => {
    const { elements, cleanup } = await setupPopupTest({
        activeTab: {
            id: 42,
            url: "https://example.com/"
        },
        initialState: {
            blockedSites: ["example.com"]
        }
    });
    t.after(cleanup);

    assert.equal(elements.rulesContent.hidden, true);
    assert.equal(elements.currentBlockSection.classList.has("is-hidden"), false);
    assert.equal(elements.currentBlockSite.textContent, "example.com");
    assert.equal(elements.currentUnblockBtn.textContent, "Unblock 10 min");
});

test("adding an already blocked site again clears its temporary unblock", async (t) => {
    const now = 1_700_000_000_000;
    const { elements, state, cleanup } = await setupPopupTest({
        activeTab: {
            id: 42,
            url: "chrome-extension://test/src/blocked/block.html?blockedRule=youtube.com"
        },
        initialState: {
            blockedSites: ["youtube.com"],
            temporaryUnblocks: {
                "youtube.com": now + 10 * 60 * 1000
            }
        },
        now
    });
    t.after(cleanup);

    assert.equal(elements.currentBlockStatus.textContent.startsWith("Unblocked until "), true);

    elements.siteInput.value = "youtube.com";
    await elements.ruleForm.onsubmit({
        preventDefault() {}
    });

    assert.deepEqual(state.temporaryUnblocks, {});
    assert.equal(elements.currentBlockStatus.textContent, "");
    assert.equal(elements.currentUnblockBtn.textContent, "Unblock 10 min");
    assert.equal(elements.formHint.textContent, "Blocked site restored.");
});

test("temporary unblock requires solving the math challenge", async (t) => {
    const now = 1_700_000_000_000;
    const { elements, chrome, state, cleanup } = await setupPopupTest({
        activeTab: {
            id: 42,
            url: "chrome-extension://test/src/blocked/block.html?blockedRule=example.com#https://example.com/"
        },
        initialState: {
            blockedSites: ["example.com"]
        },
        now
    });
    t.after(cleanup);

    elements.currentUnblockBtn.onclick();
    await Promise.resolve();
    await Promise.resolve();

    elements.unblockChallengeAnswer.value = String(getCurrentChallengeAnswer(elements) + 1);
    await elements.confirmUnblockBtn.onclick();

    assert.deepEqual(state.temporaryUnblocks, undefined);
    assert.deepEqual(chrome.tabs.updatedTabs, []);
    assert.equal(elements.unblockDialog.open, true);
    assert.equal(elements.unblockChallengeHint.textContent, "Solve the math example to continue.");

    answerCurrentChallenge(elements);
    await elements.confirmUnblockBtn.onclick();

    assert.deepEqual(state.temporaryUnblocks, {
        "example.com": now + 10 * 60 * 1000
    });
    assert.deepEqual(chrome.tabs.updatedTabs, [
        {
            tabId: 42,
            options: {
                url: "https://example.com/"
            }
        }
    ]);
});

test("math challenge uses addition, subtraction, and multiplication without division", async (t) => {
    const { elements, cleanup } = await setupPopupTest({
        activeTab: {
            id: 42,
            url: "chrome-extension://test/src/blocked/block.html?blockedRule=example.com#https://example.com/"
        },
        initialState: {
            blockedSites: ["example.com"]
        },
        randomValues: [0.5, 0.5, 0.5, 0.5, 0.5]
    });
    t.after(cleanup);

    elements.currentUnblockBtn.onclick();
    await Promise.resolve();
    await Promise.resolve();

    const challenge = elements.unblockChallengeQuestion.textContent;
    assert.match(challenge, /^Solve: \d+ - \d+ \+ \d+ x \d+ =$/);
    assert.doesNotMatch(challenge, /[/÷]/);
    assert.equal(getCurrentChallengeAnswer(elements), 239);
});

test("removing a blocked site requires solving the math challenge", async (t) => {
    const { elements, state, cleanup } = await setupPopupTest({
        activeTab: {
            id: 42,
            url: "https://example.com/"
        },
        initialState: {
            blockedSites: ["example.com", "openai.com"],
            temporaryUnblocks: {
                "example.com": Date.now() + 10 * 60 * 1000
            }
        }
    });
    t.after(cleanup);

    const removeButton = elements.list.children[0].children[1];
    removeButton.onclick();
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(elements.unblockDialog.open, true);
    assert.equal(elements.challengeDialogTitle.textContent, "Remove blocked site?");
    assert.equal(elements.unblockDialogText.textContent, "example.com will be removed from the block list.");
    assert.equal(elements.confirmUnblockBtn.textContent, "Remove");

    elements.unblockChallengeAnswer.value = String(getCurrentChallengeAnswer(elements) + 1);
    await elements.confirmUnblockBtn.onclick();

    assert.deepEqual(state.blockedSites, ["example.com", "openai.com"]);
    assert.equal(elements.unblockDialog.open, true);
    assert.equal(elements.unblockChallengeHint.textContent, "Solve the math example to continue.");

    answerCurrentChallenge(elements);
    await elements.confirmUnblockBtn.onclick();

    assert.deepEqual(state.blockedSites, ["openai.com"]);
    assert.deepEqual(state.temporaryUnblocks, {});
    assert.equal(elements.unblockDialog.open, false);
    assert.equal(elements.formHint.textContent, "Blocked site removed.");
});

async function setupPopupTest({ activeTab, initialState = {}, now, randomValues }) {
    const previousChrome = globalThis.chrome;
    const previousDocument = globalThis.document;
    const previousFileReader = globalThis.FileReader;
    const previousDateNow = Date.now;
    const previousMathRandom = Math.random;

    const elements = createPopupElements();
    const state = {
        blockedSites: [],
        ...initialState
    };
    const chrome = createChromeMock(state, activeTab);

    globalThis.chrome = chrome;
    globalThis.document = createDocumentMock(elements);
    globalThis.FileReader = class {};
    if (now) {
        Date.now = () => now;
    }
    if (randomValues) {
        let randomIndex = 0;
        Math.random = () => randomValues[randomIndex++] ?? randomValues.at(-1);
    }

    await import(`../../src/popup/popup.js?test=${Date.now()}-${Math.random()}`);
    await Promise.resolve();
    await Promise.resolve();

    return {
        elements,
        chrome,
        state,
        cleanup() {
            globalThis.chrome = previousChrome;
            globalThis.document = previousDocument;
            globalThis.FileReader = previousFileReader;
            Date.now = previousDateNow;
            Math.random = previousMathRandom;
        }
    };
}

function createPopupElements() {
    const ids = [
        "siteInput",
        "ruleForm",
        "currentSiteBtn",
        "rulesSection",
        "rulesToggle",
        "rulesContent",
        "imageInput",
        "imageHint",
        "imageState",
        "resetImageBtn",
        "list",
        "counter",
        "emptyState",
        "formHint",
        "currentBlockSection",
        "currentBlockSite",
        "currentBlockStatus",
        "currentUnblockBtn",
        "unblockDialog",
        "unblockPreview",
        "challengeDialogTitle",
        "unblockDialogText",
        "unblockChallengeQuestion",
        "unblockChallengeAnswer",
        "unblockChallengeHint",
        "cancelUnblockBtn",
        "confirmUnblockBtn"
    ];

    return Object.fromEntries(ids.map((id) => [id, createElementMock()]));
}

function answerCurrentChallenge(elements) {
    elements.unblockChallengeAnswer.value = String(getCurrentChallengeAnswer(elements));
}

function getCurrentChallengeAnswer(elements) {
    const challenge = elements.unblockChallengeQuestion.textContent
        .replace(/^Solve: /, "")
        .replace(/ =$/, "");

    let match = challenge.match(/^\((\d+) \+ (\d+)\) x (\d+) - (\d+)$/);
    if (match) {
        return (Number(match[1]) + Number(match[2])) * Number(match[3]) - Number(match[4]);
    }

    match = challenge.match(/^(\d+) x (\d+) \+ (\d+) - (\d+)$/);
    if (match) {
        return Number(match[1]) * Number(match[2]) + Number(match[3]) - Number(match[4]);
    }

    match = challenge.match(/^(\d+) - (\d+) \+ (\d+) x (\d+)$/);
    if (match) {
        return Number(match[1]) - Number(match[2]) + Number(match[3]) * Number(match[4]);
    }

    match = challenge.match(/^(\d+) - \((\d+) \+ (\d+)\) x (\d+)$/);
    if (match) {
        return Number(match[1]) - (Number(match[2]) + Number(match[3])) * Number(match[4]);
    }

    assert.fail(`Unexpected challenge: ${elements.unblockChallengeQuestion.textContent}`);
}

function createDocumentMock(elements) {
    return {
        getElementById(id) {
            return elements[id];
        },
        createElement() {
            return createElementMock();
        }
    };
}

function createElementMock() {
    const element = {
        children: [],
        classList: createClassListMock(),
        disabled: false,
        files: [],
        textContent: "",
        value: "",
        open: false,
        appendChild(child) {
            this.children.push(child);
        },
        close() {
            this.open = false;
        },
        focus() {},
        select() {
            this.wasSelected = true;
        },
        showModal() {
            this.open = true;
        },
        setAttribute(name, value) {
            this[name] = value;
        }
    };

    Object.defineProperty(element, "innerHTML", {
        get() {
            return this._innerHTML || "";
        },
        set(value) {
            this._innerHTML = value;
            this.children = [];
        }
    });

    return element;
}

function createClassListMock() {
    const classes = new Set();

    return {
        has(className) {
            return classes.has(className);
        },
        toggle(className, force) {
            if (force) {
                classes.add(className);
                return true;
            }

            classes.delete(className);
            return false;
        }
    };
}

function createChromeMock(state, activeTab) {
    return {
        runtime: {
            getURL(path) {
                return `chrome-extension://test/${path}`;
            },
            sendMessage(message, callback) {
                if (message.type === "temporaryUnblock") {
                    state.temporaryUnblocks = {
                        ...(state.temporaryUnblocks || {}),
                        [message.site]: message.expiresAt
                    };
                    callback?.({ ok: true });
                    return;
                }

                callback?.({ ok: false, message: "Unknown message" });
            }
        },
        storage: {
            local: {
                get(keys, callback) {
                    const result = Object.fromEntries(keys.map((key) => [key, state[key]]));
                    callback?.(result);
                    return result;
                },
                set(nextState, callback) {
                    Object.assign(state, nextState);
                    callback?.();
                },
                remove(keys, callback) {
                    for (const key of Array.isArray(keys) ? keys : [keys]) {
                        delete state[key];
                    }

                    callback?.();
                }
            }
        },
        tabs: {
            updatedTabs: [],
            query(queryInfo, callback) {
                this.lastQuery = queryInfo;
                callback?.([activeTab]);
                return [activeTab];
            },
            update(tabId, options, callback) {
                this.updatedTabs.push({ tabId, options });
                callback?.();
            }
        }
    };
}
