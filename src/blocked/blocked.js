const blockedImage = document.getElementById("blockedImage");
const defaultImageUrl = chrome.runtime.getURL("assets/images/image.jpg");
const imageStorageKey = "blockedImageDataUrl";

blockedImage.onerror = () => {
    blockedImage.onerror = null;
    blockedImage.src = defaultImageUrl;
};

chrome.storage.local.get([imageStorageKey], (data) => {
    blockedImage.src = data[imageStorageKey] || defaultImageUrl;
});
