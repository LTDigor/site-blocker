import {
    extensionStorage,
    getExtensionUrl
} from "../shared/extension-api.js";
import {
    matchesUrl,
    parseRule
} from "../background/rules.js";

const blockedImage = document.getElementById("blockedImage");
const defaultImageUrl = getExtensionUrl("assets/images/image.jpg");
const imageStorageKey = "blockedImageDataUrl";
const temporaryUnblocksStorageKey = "temporaryUnblocks";

setBlockedImage(defaultImageUrl);

function setBlockedImage(imageUrl, fallbackUrl = defaultImageUrl) {
    blockedImage.onerror = () => {
        blockedImage.onerror = null;
        blockedImage.src = fallbackUrl;
    };

    blockedImage.src = imageUrl;
}

extensionStorage.local.get([imageStorageKey, temporaryUnblocksStorageKey]).then((data) => {
    redirectIfTemporarilyUnblocked(data?.[temporaryUnblocksStorageKey]);
    setBlockedImage(data?.[imageStorageKey] || defaultImageUrl);
}).catch(() => {
    setBlockedImage(defaultImageUrl);
});

function redirectIfTemporarilyUnblocked(temporaryUnblocks = {}) {
    const blockedRule = getBlockedRule();
    const originalUrl = getBlockedOriginalUrl();

    if (
        blockedRule &&
        originalUrl &&
        matchesBlockedRule(originalUrl, blockedRule) &&
        Number.isFinite(temporaryUnblocks[blockedRule]) &&
        temporaryUnblocks[blockedRule] > Date.now()
    ) {
        globalThis.location.replace(originalUrl);
    }
}

function matchesBlockedRule(url, blockedRule) {
    try {
        return matchesUrl(url, [parseRule(blockedRule)]);
    } catch {
        return false;
    }
}

function getBlockedRule() {
    try {
        return new URL(globalThis.location.href).searchParams.get("blockedRule");
    } catch {
        return null;
    }
}

function getBlockedOriginalUrl() {
    try {
        const blockedUrl = new URL(globalThis.location.href).hash.slice(1);
        if (!blockedUrl) return null;

        const parsedBlockedUrl = new URL(blockedUrl);
        if (parsedBlockedUrl.protocol !== "http:" && parsedBlockedUrl.protocol !== "https:") {
            return null;
        }

        return blockedUrl;
    } catch {
        return null;
    }
}
