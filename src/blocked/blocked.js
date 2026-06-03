import {
    extensionStorage,
    getExtensionUrl
} from "../shared/extension-api.js";

const blockedImage = document.getElementById("blockedImage");
const defaultImageUrl = getExtensionUrl("assets/images/image.jpg");
const imageStorageKey = "blockedImageDataUrl";
const temporaryUnblocksStorageKey = "temporaryUnblocks";

blockedImage.src = defaultImageUrl;

blockedImage.onerror = () => {
    blockedImage.onerror = null;
    blockedImage.src = defaultImageUrl;
};

extensionStorage.local.get([imageStorageKey, temporaryUnblocksStorageKey]).then((data) => {
    redirectIfTemporarilyUnblocked(data?.[temporaryUnblocksStorageKey]);
    blockedImage.src = data?.[imageStorageKey] || defaultImageUrl;
}).catch(() => {
    blockedImage.src = defaultImageUrl;
});

function redirectIfTemporarilyUnblocked(temporaryUnblocks = {}) {
    const blockedRule = getBlockedRule();
    const originalUrl = getBlockedOriginalUrl();

    if (
        blockedRule &&
        originalUrl &&
        Number.isFinite(temporaryUnblocks[blockedRule]) &&
        temporaryUnblocks[blockedRule] > Date.now()
    ) {
        globalThis.location.replace(originalUrl);
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
