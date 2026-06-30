class API {
    constructor() {
        this.url = new URL(location.href);
    }

    // ["pfp.png"]
    async getFiles() {
        const req = await fetch(new URL("/data", this.url.origin));

        if (!req.ok) {
            console.error(`Error fetching: ${req.status} - ${req.statusText}`);
        }

        return await req.json();
    }

    // pfp.png -> http://localhost:3000/data/pfp.png
    // folder/pfp.png -> http://localhost:3000/data/folder/pfp.png
    getFile(path) {
        const encodedPath = path.split("/").map(encodeURIComponent).join("/");
        return new URL(`/data/${encodedPath}`, this.url.origin).href;
    }
}

const api = new API();

const els = {
    files: document.querySelector("#files"),
};

function renderList(files) {
    els.files.replaceChildren();

    const folders = new Map();

    for (const file of files) {
        const index = file.lastIndexOf("/");
        const folder = index === -1 ? "/" : file.slice(0, index);
        const folderFiles = folders.get(folder) || [];

        folderFiles.push(file);
        folders.set(folder, folderFiles);
    }

    const sortedFolders = [...folders.entries()].sort((a, b) => {
        const count = b[1].length - a[1].length;
        return count || a[0].localeCompare(b[0]);
    });

    for (const [folder, folderFiles] of sortedFolders) {
        const section = document.createElement("details");
        const summary = document.createElement("summary");
        const grid = document.createElement("div");

        section.className = "folder";
        section.open = true;
        summary.textContent = folder === "/" ? "/" : `/${folder}`;
        grid.className = "files";

        for (const file of folderFiles) {
            grid.append(createFileLink(file));
        }

        section.append(summary, grid);
        els.files.append(section);
    }
}

function createFileLink(file) {
    const src = api.getFile(file);
    const link = document.createElement("a");
    const image = document.createElement("img");
    const caption = document.createElement("span");

    link.className = "file";
    link.href = src;
    link.target = "_blank";
    link.rel = "noreferrer";

    image.src = src;
    image.alt = file;
    image.loading = "lazy";

    caption.textContent = file.split("/").at(-1);

    link.append(image, caption);
    return link;
}

async function init() {
    try {
        const files = await api.getFiles();
        renderList(files);

        if (files.length === 0) {
            els.files.textContent = "";
            return;
        }
    } catch (err) {
        console.error(err);
        els.files.textContent = "";
    }
}

init();
