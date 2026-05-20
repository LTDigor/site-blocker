import { getCurrentSiteFromUrl, normalizeStoredRules, validateLocalImageFile, validateRuleInput } from "./validation.js";

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

const BLOCKED_IMAGE_STORAGE_KEY = "blockedImageDataUrl";

const browser = globalThis.chrome;
const storage = browser?.storage?.local || createMemoryStorage();
let areRulesExpanded = false;

function createMemoryStorage() {
    let state = { blockedSites: [] };

    return {
        get(keys, callback) {
            callback(Object.fromEntries(keys.map((key) => [key, state[key]])));
        },
        set(nextState, callback) {
            state = { ...state, ...nextState };
            callback?.();
        },
        remove(keys, callback) {
            const keysToRemove = Array.isArray(keys) ? keys : [keys];

            for (const key of keysToRemove) {
                delete state[key];
            }

            callback?.();
        }
    };
}

function render(sites) {
    list.innerHTML = "";
    counter.textContent = sites.length;
    emptyState.classList.toggle("is-hidden", sites.length > 0);

    sites.forEach((site, index) => {
        const li = documentRef.createElement("li");
        li.className = "rule-item";

        const ruleText = documentRef.createElement("span");
        ruleText.className = "rule-text";
        ruleText.textContent = site;
        ruleText.title = site;

        const remove = documentRef.createElement("button");
        remove.className = "remove-button";
        remove.type = "button";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `Remove ${site}`);
        remove.title = "Remove blocked site";

        remove.onclick = () => {
            sites.splice(index, 1);
            save(sites);
            setHint("Blocked site removed.");
        };

        li.appendChild(ruleText);
        li.appendChild(remove);
        list.appendChild(li);
    });
}

function save(sites, callback) {
    storage.set({ blockedSites: sites }, () => {
        render(sites);
        callback?.();
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

function saveBlockedImage(file) {
    const reader = new FileReader();

    reader.onload = () => {
        storage.set({ [BLOCKED_IMAGE_STORAGE_KEY]: reader.result }, () => {
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
    storage.get(["blockedSites"], (data) => {
        const sites = data.blockedSites || [];

        if (sites.includes(rule)) {
            setHint(duplicateMessage, true);
            input.select();
            callback?.();
            return;
        }

        sites.push(rule);
        save(sites, () => {
            input.value = "";
            setHint(successMessage);
            callback?.();
        });
    });
}

function openBlockPage(tabId) {
    if (!tabId) return;

    browser.tabs.update(tabId, {
        url: browser.runtime.getURL("src/blocked/block.html")
    });
}

form.onsubmit = (event) => {
    event.preventDefault();

    const validation = validateRuleInput(input.value);
    if (!validation.isValid) {
        setHint(validation.message, true);
        input.focus();
        return;
    }

    const site = validation.value;
    saveRule(site, "Blocked site added.", "This site is already in the list.");
};

currentSiteButton.onclick = () => {
    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs?.[0];
        const site = getCurrentSiteFromUrl(currentTab?.url);

        if (!site) {
            setHint("Open a regular website to add its current site.", true);
            return;
        }

        input.value = site;
        saveRule(site, "Current site added.", "This site is already in the list.", () => {
            openBlockPage(currentTab.id);
        });
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
    storage.remove(BLOCKED_IMAGE_STORAGE_KEY, () => {
        renderImageState(false);
        setImageHint("Default block image restored.");
    });
};

setRulesExpanded(false);

storage.get(["blockedSites"], (data) => {
    const sites = data.blockedSites || [];
    const normalizedSites = normalizeStoredRules(sites);

    if (!areSameRules(sites, normalizedSites)) {
        storage.set({ blockedSites: normalizedSites }, () => {
            render(normalizedSites);
        });
        return;
    }

    render(normalizedSites);
});

storage.get([BLOCKED_IMAGE_STORAGE_KEY], (data) => {
    renderImageState(Boolean(data[BLOCKED_IMAGE_STORAGE_KEY]));
});

function areSameRules(leftRules, rightRules) {
    return leftRules.length === rightRules.length &&
        leftRules.every((rule, index) => rule === rightRules[index]);
}
