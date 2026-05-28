import {
    extensionStorage,
    getExtensionUrl
} from "../shared/extension-api.js";

const blockedImage = document.getElementById("blockedImage");
const defaultImageUrl = getExtensionUrl("assets/images/image.jpg");
const imageStorageKey = "blockedImageDataUrl";

blockedImage.onerror = () => {
    blockedImage.onerror = null;
    blockedImage.src = defaultImageUrl;
};

extensionStorage.local.get([imageStorageKey]).then((data) => {
    blockedImage.src = data[imageStorageKey] || defaultImageUrl;
});
