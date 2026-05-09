const input = document.getElementById("siteInput");
const addBtn = document.getElementById("addBtn");
const list = document.getElementById("list");

function render(sites) {
    list.innerHTML = "";

    sites.forEach((site, index) => {
        const li = document.createElement("li");
        li.textContent = site;

        const remove = document.createElement("button");
        remove.textContent = "X";

        remove.onclick = () => {
            sites.splice(index, 1);
            save(sites);
        };

        li.appendChild(remove);
        list.appendChild(li);
    });
}

function save(sites) {
    chrome.storage.local.set({ blockedSites: sites }, () => {
        render(sites);
    });
}

addBtn.onclick = () => {
    const site = input.value.trim();
    if (!site) return;

    chrome.storage.local.get(["blockedSites"], (data) => {
        const sites = data.blockedSites || [];
        sites.push(site);
        save(sites);
        input.value = "";
    });
};

chrome.storage.local.get(["blockedSites"], (data) => {
    render(data.blockedSites || []);
});