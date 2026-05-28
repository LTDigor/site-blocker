import { getCurrentSiteFromUrl, normalizeStoredRules, validateLocalImageFile, validateRuleInput } from "./validation.js";
import {
    extensionRuntime,
    extensionStorage,
    extensionTabs,
    getExtensionUrl,
    hasExtensionApi
} from "../shared/extension-api.js";

const documentRef = globalThis.document;

const input = documentRef.getElementById("siteInput");
const form = documentRef.getElementById("ruleForm");
const currentSiteButton = documentRef.getElementById("currentSiteBtn");
const rulesSection = documentRef.getElementById("rulesSection");
const rulesToggle = documentRef.getElementById("rulesToggle");
const rulesContent = documentRef.getElementById("rulesContent");
const imageInput = documentRef.getElementById("imageInput");
const imageHint = documentRef.getElementById("imageHint");
const imageState = documentRef.getElementById("imageState");
const resetImageButton = documentRef.getElementById("resetImageBtn");
const list = documentRef.getElementById("list");
const counter = documentRef.getElementById("counter");
const emptyState = documentRef.getElementById("emptyState");
const formHint = documentRef.getElementById("formHint");
const currentBlockSection = documentRef.getElementById("currentBlockSection");
const currentBlockSite = documentRef.getElementById("currentBlockSite");
const currentBlockStatus = documentRef.getElementById("currentBlockStatus");
const currentUnblockButton = documentRef.getElementById("currentUnblockBtn");
const unblockDialog = documentRef.getElementById("unblockDialog");
const unblockPreview = documentRef.getElementById("unblockPreview");
const unblockDialogText = documentRef.getElementById("unblockDialogText");
const cancelUnblockButton = documentRef.getElementById("cancelUnblockBtn");
const confirmUnblockButton = documentRef.getElementById("confirmUnblockBtn");

const BLOCKED_IMAGE_STORAGE_KEY = "blockedImageDataUrl";
const TEMPORARY_UNBLOCKS_KEY = "temporaryUnblocks";
const TEMPORARY_UNBLOCK_DURATION_MS = 10 * 60 * 1000;
const DEFAULT_BLOCK_IMAGE_URL = hasExtensionApi() ?
    getExtensionUrl("assets/images/image.jpg") :
    "../../assets/images/image.jpg";

const storage = hasExtensionApi() ? extensionStorage.local : createMemoryStorage();
let areRulesExpanded = false;
let currentSites = [];
let currentTemporaryUnblocks = {};
let selectedUnblockSite = null;
let currentBlockedRule = null;
let currentTabId = null;

function createMemoryStorage() {
    let state = { blockedSites: [], temporaryUnblocks: {} };

    return {
        get(keys, callback) {
            callback?.(Object.fromEntries(keys.map((key) => [key, state[key]])));
            return Promise.resolve(Object.fromEntries(keys.map((key) => [key, state[key]])));
        },
        set(nextState, callback) {
            state = { ...state, ...nextState };
            callback?.();
            return Promise.resolve();
        },
        remove(keys, callback) {
            const keysToRemove = Array.isArray(keys) ? keys : [keys];

            for (const key of keysToRemove) {
                delete state[key];
            }

            callback?.();
            return Promise.resolve();
        }
    };
}

function render(sites, temporaryUnblocks = currentTemporaryUnblocks) {
    currentSites = [...sites];
    currentTemporaryUnblocks = cleanTemporaryUnblocks(temporaryUnblocks, sites);
    renderCurrentBlockedSite(sites);
    list.innerHTML = "";
    counter.textContent = sites.length;
    emptyState.classList.toggle("is-hidden", sites.length > 0);

    sites.forEach((site) => {
        const li = documentRef.createElement("li");
        li.className = "rule-item rule-item-static";

        const ruleDetails = documentRef.createElement("div");
        ruleDetails.className = "rule-details";

        const ruleText = documentRef.createElement("span");
        ruleText.className = "rule-text";
        ruleText.textContent = site;
        ruleText.title = site;

        const unblockStatus = documentRef.createElement("span");
        unblockStatus.className = "rule-status";
        const expiresAt = currentTemporaryUnblocks[site];
        unblockStatus.textContent = expiresAt ? `Unblocked until ${formatTime(expiresAt)}` : "";

        const remove = documentRef.createElement("button");
        remove.className = "remove-button";
        remove.type = "button";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `Remove ${site}`);
        remove.title = "Remove blocked site";

        remove.onclick = () => {
            removeBlockedSite(sites, site);
        };

        ruleDetails.appendChild(ruleText);
        ruleDetails.appendChild(unblockStatus);
        li.appendChild(ruleDetails);
        li.appendChild(remove);
        list.appendChild(li);
    });
}

function renderCurrentBlockedSite(sites) {
    const site = getCurrentUnblockableSite(sites);
    currentBlockSection.classList.toggle("is-hidden", !site);

    if (!site) return;

    const expiresAt = currentTemporaryUnblocks[site];
    currentBlockSite.textContent = site;
    currentBlockStatus.textContent = expiresAt ? `Unblocked until ${formatTime(expiresAt)}` : "";
    currentUnblockButton.textContent = expiresAt ? "Extend 10 min" : "Unblock 10 min";
    currentUnblockButton.setAttribute("aria-label", `Unblock ${site} for 10 minutes`);
    currentUnblockButton.onclick = () => {
        openUnblockDialog(site);
    };
}

function getCurrentUnblockableSite(sites) {
    if (currentBlockedRule && sites.includes(currentBlockedRule)) {
        return currentBlockedRule;
    }

    if (sites.length === 1) {
        return sites[0];
    }

    return null;
}

function save(sites, callback) {
    return storage.set({ blockedSites: sites }).then(() => {
        render(sites, currentTemporaryUnblocks);
        return callback?.();
    });
}

function removeBlockedSite(sites, site) {
    const nextSites = [...sites];
    const nextTemporaryUnblocks = { ...currentTemporaryUnblocks };
    const index = nextSites.indexOf(site);

    if (index === -1) return Promise.resolve();

    nextSites.splice(index, 1);
    delete nextTemporaryUnblocks[site];

    return storage
        .set({
            blockedSites: nextSites,
            [TEMPORARY_UNBLOCKS_KEY]: nextTemporaryUnblocks
        })
        .then(() => {
            render(nextSites, nextTemporaryUnblocks);
            setHint("Blocked site removed.");
        });
}

function setHint(message, isError = false) {
    formHint.textContent = message;
    formHint.classList.toggle("is-error", isError);
}

function setRulesExpanded(isExpanded) {
    areRulesExpanded = isExpanded;
    rulesContent.hidden = !isExpanded;
    rulesToggle.setAttribute("aria-expanded", String(isExpanded));
    rulesSection.classList.toggle("is-collapsed", !isExpanded);
}

function setImageHint(message, isError = false) {
    imageHint.textContent = message;
    imageHint.classList.toggle("is-error", isError);
}

function renderImageState(hasCustomImage) {
    imageState.textContent = hasCustomImage ? "Custom" : "Default";
    resetImageButton.disabled = !hasCustomImage;
}

function cleanTemporaryUnblocks(temporaryUnblocks = {}, sites = currentSites, now = Date.now()) {
    const siteSet = new Set(sites);

    return Object.fromEntries(
        Object.entries(temporaryUnblocks)
            .filter(([site, expiresAt]) =>
                siteSet.has(site) &&
                Number.isFinite(expiresAt) &&
                expiresAt > now
            )
    );
}

function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function getResolvedBlockImage() {
    return storage.get([BLOCKED_IMAGE_STORAGE_KEY]).then((data) => {
        return data[BLOCKED_IMAGE_STORAGE_KEY] || DEFAULT_BLOCK_IMAGE_URL;
    });
}

function openUnblockDialog(site) {
    selectedUnblockSite = site;
    unblockDialogText.textContent = `${site} will be available for 10 minutes.`;
    unblockPreview.src = DEFAULT_BLOCK_IMAGE_URL;

    getResolvedBlockImage().then((imageUrl) => {
        unblockPreview.src = imageUrl;
    });

    if (typeof unblockDialog.showModal === "function") {
        unblockDialog.showModal();
        return;
    }

    unblockDialog.open = true;
}

function closeUnblockDialog() {
    selectedUnblockSite = null;

    if (typeof unblockDialog.close === "function") {
        unblockDialog.close();
        return;
    }

    unblockDialog.open = false;
}

function confirmTemporaryUnblock() {
    if (!selectedUnblockSite) return Promise.resolve();

    const site = selectedUnblockSite;
    const expiresAt = Date.now() + TEMPORARY_UNBLOCK_DURATION_MS;

    return storage.get(["blockedSites", TEMPORARY_UNBLOCKS_KEY]).then((data) => {
        const sites = data.blockedSites || [];
        const temporaryUnblocks = cleanTemporaryUnblocks(data[TEMPORARY_UNBLOCKS_KEY], sites);
        const nextTemporaryUnblocks = {
            ...temporaryUnblocks,
            [site]: expiresAt
        };

        return saveTemporaryUnblock(site, expiresAt, nextTemporaryUnblocks)
            .then(() => {
                render(sites, nextTemporaryUnblocks);
                closeUnblockDialog();
                return openTemporarilyUnblockedSite(site);
            });
    });
}

function saveTemporaryUnblock(site, expiresAt, nextTemporaryUnblocks) {
    if (!hasExtensionApi()) {
        return storage.set({ [TEMPORARY_UNBLOCKS_KEY]: nextTemporaryUnblocks });
    }

    return extensionRuntime
        .sendMessage({
            type: "temporaryUnblock",
            site,
            expiresAt
        })
        .then((response) => {
            if (!response?.ok) {
                throw new Error(response?.message || "Temporary unblock failed");
            }
        });
}

function openTemporarilyUnblockedSite(site) {
    if (!currentTabId || !hasExtensionApi()) return Promise.resolve();

    return extensionTabs.update(currentTabId, {
        url: getUrlForRule(site)
    });
}

function getUrlForRule(site) {
    const [domain, pathPart = ""] = site.split("/");
    const path = pathPart && !pathPart.startsWith("^") ? `/${pathPart}` : "/";

    return `https://${domain}${path}`;
}

function saveBlockedImage(file) {
    const reader = new FileReader();

    reader.onload = () => {
        storage.set({ [BLOCKED_IMAGE_STORAGE_KEY]: reader.result }).then(() => {
            renderImageState(true);
            setImageHint("Local block image saved.");
        });
    };

    reader.onerror = () => {
        setImageHint("Could not read this image file.", true);
    };

    reader.readAsDataURL(file);
}

function saveRule(rule, successMessage, duplicateMessage, callback) {
    return storage.get(["blockedSites", TEMPORARY_UNBLOCKS_KEY]).then((data) => {
        const sites = data.blockedSites || [];

        if (sites.includes(rule)) {
            const temporaryUnblocks = cleanTemporaryUnblocks(data[TEMPORARY_UNBLOCKS_KEY], sites);

            if (temporaryUnblocks[rule]) {
                const nextTemporaryUnblocks = { ...temporaryUnblocks };
                delete nextTemporaryUnblocks[rule];

                return storage
                    .set({ [TEMPORARY_UNBLOCKS_KEY]: nextTemporaryUnblocks })
                    .then(() => {
                        input.value = "";
                        render(sites, nextTemporaryUnblocks);
                        setHint("Blocked site restored.");
                        return callback?.();
                    });
            }

            setHint(duplicateMessage, true);
            input.select();
            return callback?.();
        }

        return save([...sites, rule], () => {
            input.value = "";
            setHint(successMessage);
            return callback?.();
        });
    });
}

async function openBlockPage(tabId, site) {
    if (!tabId) return;

    const blockPagePath = site ?
        `src/blocked/block.html?blockedRule=${encodeURIComponent(site)}` :
        "src/blocked/block.html";

    await extensionTabs.update(tabId, {
        url: getExtensionUrl(blockPagePath)
    });
}

form.onsubmit = async (event) => {
    event.preventDefault();

    const validation = validateRuleInput(input.value);
    if (!validation.isValid) {
        setHint(validation.message, true);
        input.focus();
        return;
    }

    const site = validation.value;
    await saveRule(site, "Blocked site added.", "This site is already in the list.");
};

currentSiteButton.onclick = async () => {
    const tabs = await extensionTabs.query({ active: true, currentWindow: true });
    const currentTab = tabs?.[0];
    const site = getCurrentSiteFromUrl(currentTab?.url);

    if (!site) {
        setHint("Open a regular website to add its current site.", true);
        return;
    }

    input.value = site;
    await saveRule(site, "Current site added.", "This site is already in the list.", () => {
        return openBlockPage(currentTab.id, site);
    });
};

rulesToggle.onclick = () => {
    setRulesExpanded(!areRulesExpanded);
};

imageInput.onchange = () => {
    const file = imageInput.files?.[0];
    const validation = validateLocalImageFile(file);

    if (!validation.isValid) {
        setImageHint(validation.message, true);
        imageInput.value = "";
        return;
    }

    saveBlockedImage(file);
    imageInput.value = "";
};

resetImageButton.onclick = () => {
    storage.remove(BLOCKED_IMAGE_STORAGE_KEY).then(() => {
        renderImageState(false);
        setImageHint("Default block image restored.");
    });
};

cancelUnblockButton.onclick = () => {
    closeUnblockDialog();
};

confirmUnblockButton.onclick = () => {
    return confirmTemporaryUnblock();
};

setRulesExpanded(false);

initializeCurrentTabContext().then(() => storage.get(["blockedSites", TEMPORARY_UNBLOCKS_KEY])).then((data) => {
    const sites = data.blockedSites || [];
    const normalizedSites = normalizeStoredRules(sites);
    const temporaryUnblocks = cleanTemporaryUnblocks(data[TEMPORARY_UNBLOCKS_KEY], normalizedSites);
    const shouldSaveSites = !areSameRules(sites, normalizedSites);
    const shouldSaveTemporaryUnblocks =
        !areSameTemporaryUnblocks(data[TEMPORARY_UNBLOCKS_KEY] || {}, temporaryUnblocks);

    if (shouldSaveSites || shouldSaveTemporaryUnblocks) {
        storage.set({
            blockedSites: normalizedSites,
            [TEMPORARY_UNBLOCKS_KEY]: temporaryUnblocks
        }).then(() => {
            render(normalizedSites, temporaryUnblocks);
        });
        return;
    }

    render(normalizedSites, temporaryUnblocks);
});

storage.get([BLOCKED_IMAGE_STORAGE_KEY]).then((data) => {
    renderImageState(Boolean(data[BLOCKED_IMAGE_STORAGE_KEY]));
});

function areSameRules(leftRules, rightRules) {
    return leftRules.length === rightRules.length &&
        leftRules.every((rule, index) => rule === rightRules[index]);
}

function areSameTemporaryUnblocks(leftUnblocks, rightUnblocks) {
    const leftEntries = Object.entries(leftUnblocks);
    const rightEntries = Object.entries(rightUnblocks);

    return leftEntries.length === rightEntries.length &&
        leftEntries.every(([site, expiresAt]) => rightUnblocks[site] === expiresAt);
}

async function initializeCurrentTabContext() {
    if (!hasExtensionApi()) return;

    const tabs = await extensionTabs.query({ active: true, currentWindow: true });
    const currentTab = tabs?.[0];
    currentTabId = currentTab?.id || null;
    currentBlockedRule = getBlockedRuleFromBlockPageUrl(currentTab?.url);

    if (currentBlockedRule) {
        setRulesExpanded(true);
    }
}

function getBlockedRuleFromBlockPageUrl(urlString) {
    try {
        const url = new URL(urlString);
        const blockedPageUrl = new URL(getExtensionUrl("src/blocked/block.html"));

        if (
            url.protocol !== blockedPageUrl.protocol ||
            url.hostname !== blockedPageUrl.hostname ||
            url.pathname !== blockedPageUrl.pathname
        ) {
            return null;
        }

        return url.searchParams.get("blockedRule");
    } catch {
        return null;
    }
}
