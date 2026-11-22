"use strict";

/* =========================================
   DRAG SHELF
   PHASE 5 — PERFORMANCE & RELIABILITY
========================================= */


/* =========================================
   DOM REFERENCES
========================================= */

const $ = selector => document.querySelector(selector);

const elements = {
    pageTitle: $("#page-title"),

    collectionList: $("#collection-list"),

    addCollection: $("#add-collection"),

    addFiles: $("#add-files"),
    emptyAddFiles: $("#empty-add-files"),

    pasteButton: $("#paste-button"),

    search: $("#search"),

    list: $("#list"),
    listHeading: $("#list-heading"),
    itemCount: $("#item-count"),

    emptyState: $("#empty-state"),
    emptyTitle: $("#empty-title"),
    emptyDescription: $("#empty-description"),

    dropZone: $("#drop-zone"),

    menuBackdrop: $("#menu-backdrop"),
    contextMenu: $("#context-menu"),

    previewBackdrop: $("#preview-backdrop"),
    previewTitle: $("#preview-title"),
    previewBody: $("#preview-body"),
    previewClose: $("#preview-close"),
    previewCopy: $("#preview-copy"),
    previewOpen: $("#preview-open"),

    toast: $("#toast")
};


/* =========================================
   APPLICATION STATE
========================================= */

const state = {
    items: [],
    collections: [],

    activeView: "all",
    activeCollection: null,
    activeFilter: "all",

    currentMenuItem: null,
    currentPreviewItem: null,

    renderVersion: 0,

    toastTimeout: null,
    searchTimeout: null,

    saveQueue: Promise.resolve(),

    thumbnailPromises: new Map(),

    maxThumbnailPromises: 120,

    observer: null
};


const QUICK_ACCESS_ID = "quick-access";


/* =========================================
   UTILITIES
========================================= */

function generateId() {

    if (crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return (
        Date.now().toString(36) +
        Math.random().toString(36).slice(2)
    );
}


function escapeHTML(value) {

    return String(value ?? "").replace(
        /[&<>"']/g,
        character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[character]
    );
}


function getFileName(value) {

    if (!value) return "Untitled";

    const clean = String(value).split(/[\\/]/);

    return clean[clean.length - 1] || "Untitled";
}


function getExtension(value) {

    const name = getFileName(value);

    const index = name.lastIndexOf(".");

    if (index === -1) return "";

    return name.slice(index).toLowerCase();
}


function getItemExtension(item) {

    if (!item || item.type !== "file") {
        return "";
    }

    return getExtension(item.value);
}


function isImage(item) {

    if (!item || item.type !== "file") {
        return false;
    }

    return [
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".webp",
        ".bmp"
    ].includes(getItemExtension(item));
}


function isDocument(item) {

    if (!item || item.type !== "file") {
        return false;
    }

    return [
        ".pdf",
        ".doc",
        ".docx",
        ".txt",
        ".md",
        ".csv",
        ".xls",
        ".xlsx",
        ".ppt",
        ".pptx"
    ].includes(getItemExtension(item));
}


function getItemIcon(item) {

    if (item.type === "link") return "↗";

    if (item.type === "text") return "T";

    const extension = getItemExtension(item);

    if (isImage(item)) return "▧";

    if ([
        ".pdf",
        ".doc",
        ".docx",
        ".txt",
        ".md"
    ].includes(extension)) return "▤";

    if ([
        ".xls",
        ".xlsx",
        ".csv"
    ].includes(extension)) return "▦";

    if ([
        ".zip",
        ".rar",
        ".7z"
    ].includes(extension)) return "▱";

    if ([
        ".mp4",
        ".mov",
        ".avi",
        ".mkv"
    ].includes(extension)) return "▶";

    if ([
        ".mp3",
        ".wav",
        ".flac"
    ].includes(extension)) return "♫";

    return "▧";
}


function getCollectionName(collectionId) {

    const collection = state.collections.find(
        item => item.id === collectionId
    );

    return collection?.name || "Quick Access";
}


function formatFileSize(bytes) {

    if (!Number.isFinite(bytes)) return "";

    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    if (bytes < 1024 * 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}


function getDateLabel(timestamp) {

    if (!timestamp) return "";

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const today = new Date();

    const sameDay =
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();

    if (sameDay) return "Today";

    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short"
    });
}


function showToast(message, duration = 2400) {

    clearTimeout(state.toastTimeout);

    elements.toast.textContent = message;

    elements.toast.classList.add("show");

    state.toastTimeout = setTimeout(() => {
        elements.toast.classList.remove("show");
    }, duration);
}


function isValidURL(value) {

    try {

        const url = new URL(value);

        return (
            url.protocol === "http:" ||
            url.protocol === "https:"
        );

    } catch {
        return false;
    }
}


function isEditableElement(element) {

    if (!element) return false;

    return (
        element.tagName === "INPUT" ||
        element.tagName === "TEXTAREA" ||
        element.isContentEditable
    );
}


/* =========================================
   STORAGE / DATA
========================================= */

async function refreshData() {

    try {

        const [items, collections] = await Promise.all([
            window.shelf.getItems(),
            window.shelf.getCollections()
        ]);

        state.items = Array.isArray(items) ? items : [];

        state.collections = Array.isArray(collections)
            ? collections
            : [];

        if (
            !state.collections.some(
                collection => collection.id === QUICK_ACCESS_ID
            )
        ) {
            state.collections.unshift({
                id: QUICK_ACCESS_ID,
                name: "Quick Access"
            });
        }

        renderCollections();

        render();

    } catch (error) {

        console.error("Failed to load shelf:", error);

        showToast("Unable to load your shelf.");
    }
}


function sync() {

    const snapshot = state.items.map(item => ({ ...item }));

    state.saveQueue = state.saveQueue
        .catch(() => {})
        .then(() => window.shelf.updateItems(snapshot))
        .catch(error => {

            console.error("Shelf save failed:", error);

            showToast("Unable to save shelf changes.");

            throw error;
        });

    return state.saveQueue;
}


/* =========================================
   DUPLICATE DETECTION
========================================= */

function normalizeFilePath(value) {

    return String(value || "")
        .trim()
        .replace(/\//g, "\\")
        .toLowerCase();
}


function normalizeLink(value) {

    try {
        return new URL(value).href.toLowerCase();
    } catch {
        return String(value).trim().toLowerCase();
    }
}


function isDuplicate(type, value) {

    return state.items.some(item => {

        if (item.type !== type) {
            return false;
        }

        if (type === "file") {
            return (
                normalizeFilePath(item.value) ===
                normalizeFilePath(value)
            );
        }

        if (type === "link") {
            return (
                normalizeLink(item.value) ===
                normalizeLink(value)
            );
        }

        return item.value === value;
    });
}


/* =========================================
   COLLECTIONS
========================================= */

function renderCollections() {

    const fragment = document.createDocumentFragment();

    for (const collection of state.collections) {

        const count = state.items.filter(
            item => item.collectionId === collection.id
        ).length;

        const button = document.createElement("button");

        button.className = "collection-item";

        if (
            state.activeView === "collection" &&
            state.activeCollection === collection.id
        ) {
            button.classList.add("active");
        }

        button.dataset.collectionId = collection.id;

        button.innerHTML = `
            <span class="collection-icon">▰</span>

            <span class="collection-name">
                ${escapeHTML(collection.name)}
            </span>

            <span class="collection-count">
                ${count}
            </span>
        `;

        button.addEventListener("click", () => {

            state.activeView = "collection";
            state.activeCollection = collection.id;

            updateNavigation();

            render();
        });

        button.addEventListener("contextmenu", event => {

            event.preventDefault();

            if (collection.id === QUICK_ACCESS_ID) {
                return;
            }

            const action = prompt(
                `Collection: ${collection.name}\n\nType R to rename or D to delete.`
            );

            if (!action) return;

            if (action.toLowerCase() === "r") {
                renameCollection(collection);
            }

            if (action.toLowerCase() === "d") {
                deleteCollection(collection);
            }
        });

        fragment.appendChild(button);
    }

    elements.collectionList.replaceChildren(fragment);
}


async function createCollection() {

    const name = prompt("Enter collection name:");

    if (!name || !name.trim()) return;

    try {

        const result = await window.shelf.createCollection(
            name.trim()
        );

        if (result?.success === false) {
            throw new Error(result.error || "Could not create collection.");
        }

        await refreshData();

        showToast("Collection created.");

    } catch (error) {

        console.error(error);

        showToast(error.message || "Unable to create collection.");
    }
}


async function renameCollection(collection) {

    const name = prompt(
        "Enter the new collection name:",
        collection.name
    );

    if (!name || !name.trim()) return;

    try {

        const result = await window.shelf.renameCollection(
            collection.id,
            name.trim()
        );

        if (result?.success === false) {
            throw new Error(result.error || "Could not rename collection.");
        }

        await refreshData();

        showToast("Collection renamed.");

    } catch (error) {

        console.error(error);

        showToast(error.message || "Unable to rename collection.");
    }
}


async function deleteCollection(collection) {

    const confirmed = confirm(
        `Delete "${collection.name}"?\n\nItems will be moved to Quick Access.`
    );

    if (!confirmed) return;

    try {

        const result = await window.shelf.deleteCollection(
            collection.id
        );

        if (result?.success === false) {
            throw new Error(result.error || "Could not delete collection.");
        }

        if (state.activeCollection === collection.id) {
            state.activeView = "all";
            state.activeCollection = null;
        }

        await refreshData();

        showToast("Collection deleted.");

    } catch (error) {

        console.error(error);

        showToast(error.message || "Unable to delete collection.");
    }
}


/* =========================================
   NAVIGATION
========================================= */

function updateNavigation() {

    document.querySelectorAll("[data-view]").forEach(button => {

        button.classList.toggle(
            "active",
            button.dataset.view === state.activeView
        );
    });

    document.querySelectorAll(".collection-item").forEach(button => {

        button.classList.toggle(
            "active",
            state.activeView === "collection" &&
            button.dataset.collectionId === state.activeCollection
        );
    });

    if (state.activeView === "all") {
        elements.pageTitle.textContent = "All Items";
    }

    if (state.activeView === "recent") {
        elements.pageTitle.textContent = "Recent";
    }

    if (state.activeView === "collection") {
        elements.pageTitle.textContent = getCollectionName(
            state.activeCollection
        );
    }
}


document.querySelectorAll("[data-view]").forEach(button => {

    button.addEventListener("click", () => {

        state.activeView = button.dataset.view;
        state.activeCollection = null;

        updateNavigation();

        render();
    });
});


/* =========================================
   FILTERS
========================================= */

document.querySelectorAll("[data-filter]").forEach(button => {

    button.addEventListener("click", () => {

        state.activeFilter = button.dataset.filter;

        document.querySelectorAll("[data-filter]").forEach(filter => {
            filter.classList.toggle(
                "active",
                filter.dataset.filter === state.activeFilter
            );
        });

        render();
    });
});


/* =========================================
   SEARCH
========================================= */

elements.search.addEventListener("input", () => {

    clearTimeout(state.searchTimeout);

    state.searchTimeout = setTimeout(() => {
        render();
    }, 180);
});


/* =========================================
   VISIBLE ITEMS
========================================= */

function getVisibleItems() {

    let items = [...state.items];

    if (state.activeView === "recent") {

        items.sort(
            (a, b) =>
                new Date(b.createdAt || 0) -
                new Date(a.createdAt || 0)
        );

        items = items.slice(0, 50);
    }

    if (state.activeView === "collection") {

        items = items.filter(
            item => item.collectionId === state.activeCollection
        );
    }

    if (state.activeFilter === "file") {
        items = items.filter(item => item.type === "file");
    }

    if (state.activeFilter === "image") {
        items = items.filter(isImage);
    }

    if (state.activeFilter === "document") {
        items = items.filter(isDocument);
    }

    if (state.activeFilter === "link") {
        items = items.filter(item => item.type === "link");
    }

    if (state.activeFilter === "text") {
        items = items.filter(item => item.type === "text");
    }

    const query = elements.search.value.trim().toLowerCase();

    if (query) {

        items = items.filter(item => {

            const name = String(item.name || "").toLowerCase();

            const value = String(item.value || "").toLowerCase();

            return (
                name.includes(query) ||
                value.includes(query)
            );
        });
    }

    return items;
}


/* =========================================
   FILE VALIDATION
========================================= */

async function validateFiles(items, version) {

    const files = items.filter(
        item => item.type === "file"
    );

    const missingIds = new Set();

    const batchSize = 40;

    for (
        let index = 0;
        index < files.length;
        index += batchSize
    ) {

        if (version !== state.renderVersion) {
            return missingIds;
        }

        const batch = files.slice(index, index + batchSize);

        const results = await Promise.all(
            batch.map(async item => {

                try {
                    return await window.shelf.checkFile(item.id);
                } catch {
                    return false;
                }
            })
        );

        batch.forEach((item, position) => {

            if (!results[position]) {
                missingIds.add(item.id);
            }
        });
    }

    return missingIds;
}


/* =========================================
   RENDER
========================================= */

async function render() {

    const version = ++state.renderVersion;

    updateNavigation();

    const visibleItems = getVisibleItems();

    elements.itemCount.textContent =
        `${visibleItems.length} ${visibleItems.length === 1 ? "item" : "items"}`;

    elements.listHeading.textContent =
        state.activeView === "recent"
            ? "Recently Added"
            : state.activeView === "collection"
                ? "Collection Items"
                : "Your Items";

    if (visibleItems.length === 0) {

        elements.list.replaceChildren();

        elements.emptyState.style.display = "block";

        if (elements.search.value.trim()) {

            elements.emptyTitle.textContent = "No results found";

            elements.emptyDescription.textContent =
                "Try a different search term.";

            elements.emptyAddFiles.style.display = "none";

        } else {

            elements.emptyTitle.textContent = "Your shelf is empty";

            elements.emptyDescription.textContent =
                "Add files or drop something here to get started.";

            elements.emptyAddFiles.style.display = "inline-block";
        }

        return;
    }

    elements.emptyState.style.display = "none";

    const fragment = document.createDocumentFragment();

    const missingIds = await validateFiles(
        visibleItems,
        version
    );

    if (version !== state.renderVersion) {
        return;
    }

    for (const item of visibleItems) {

        const element = createItemElement(
            item,
            missingIds.has(item.id)
        );

        fragment.appendChild(element);
    }

    if (version !== state.renderVersion) {
        return;
    }

    elements.list.replaceChildren(fragment);

    observeThumbnails();
}


/* =========================================
   ITEM ELEMENT
========================================= */

function createItemElement(item, isMissing = false) {

    const row = document.createElement("div");

    row.className = "item-row";

    row.dataset.itemId = item.id;

    if (isMissing) {
        row.classList.add("missing");
    }

    const icon = getItemIcon(item);

    let secondary = "";

    if (item.type === "file") {
        secondary = item.value;
    }

    if (item.type === "link") {
        secondary = item.value;
    }

    if (item.type === "text") {
        secondary = String(item.value || "").slice(0, 100);
    }

    const collectionOptions = state.collections.map(collection => `
        <option
            value="${escapeHTML(collection.id)}"
            ${collection.id === item.collectionId ? "selected" : ""}
        >
            ${escapeHTML(collection.name)}
        </option>
    `).join("");

    row.innerHTML = `

        <div class="item-icon ${isImage(item) ? "previewable" : ""}">
            <span>${icon}</span>
        </div>

        <div class="item-details">

            <div class="item-name">
                ${escapeHTML(item.name || "Untitled")}
            </div>

            <div class="item-secondary ${isMissing ? "item-missing" : ""}">
                ${isMissing ? "File not found — locate it to restore access" : escapeHTML(secondary)}
            </div>

        </div>

        <div class="item-meta">
            ${escapeHTML(getDateLabel(item.createdAt))}
        </div>

        <select class="item-collection" title="Move to collection">
            ${collectionOptions}
        </select>

        <div class="item-actions">

            <button class="item-action preview-action" title="Preview">
                ◉
            </button>

            <button class="item-action menu-action" title="More options">
                ⋯
            </button>

        </div>
    `;


    /* IMAGE THUMBNAIL */

    if (isImage(item) && !isMissing) {

        const iconContainer = row.querySelector(".item-icon");

        const image = document.createElement("img");

        image.alt = "";

        image.dataset.thumbnailId = item.id;

        iconContainer.replaceChildren(image);

        image.addEventListener("click", () => {
            openPreview(item);
        });
    }


    /* PREVIEW */

    row.querySelector(".preview-action").addEventListener(
        "click",
        () => openPreview(item)
    );

    row.querySelector(".item-icon").addEventListener(
        "click",
        () => {
            if (!isImage(item)) {
                openPreview(item);
            }
        }
    );


    /* CONTEXT MENU */

    row.querySelector(".menu-action").addEventListener(
        "click",
        event => {

            event.stopPropagation();

            showContextMenu(item, event);
        }
    );


    /* COLLECTION */

    row.querySelector(".item-collection").addEventListener(
        "change",
        async event => {

            const collectionId = event.target.value;

            try {

                const result = await window.shelf.moveItem(
                    item.id,
                    collectionId
                );

                if (result?.success === false) {
                    throw new Error(result.error || "Could not move item.");
                }

                item.collectionId = collectionId;

                renderCollections();

                render();

                showToast("Item moved.");

            } catch (error) {

                console.error(error);

                showToast(error.message || "Unable to move item.");
            }
        }
    );


    /* DRAG OUT */

    if (item.type === "file" && !isMissing) {

        row.draggable = true;

        row.addEventListener("dragstart", event => {

            event.dataTransfer.effectAllowed = "copy";

            event.dataTransfer.setData(
                "text/plain",
                item.value
            );

            row.classList.add("dragging");

            window.shelf.dragOut(item.value);
        });

        row.addEventListener("dragend", () => {
            row.classList.remove("dragging");
        });
    }

    return row;
}


/* =========================================
   THUMBNAIL SYSTEM
========================================= */

function initializeThumbnailObserver() {

    if (!("IntersectionObserver" in window)) {
        return;
    }

    state.observer = new IntersectionObserver(
        entries => {

            entries.forEach(entry => {

                if (!entry.isIntersecting) {
                    return;
                }

                const image = entry.target;

                const itemId = image.dataset.thumbnailId;

                if (!itemId) return;

                state.observer.unobserve(image);

                loadThumbnail(itemId, image);
            });
        },
        {
            root: null,
            rootMargin: "150px",
            threshold: 0.01
        }
    );
}


function observeThumbnails() {

    if (!state.observer) {
        initializeThumbnailObserver();
    }

    const images = document.querySelectorAll(
        "img[data-thumbnail-id]:not(.loaded)"
    );

    images.forEach(image => {

        if (state.observer) {
            state.observer.observe(image);
        } else {
            loadThumbnail(
                image.dataset.thumbnailId,
                image
            );
        }
    });
}


async function loadThumbnail(itemId, imageElement) {

    if (!itemId || !imageElement) return;

    try {

        let promise = state.thumbnailPromises.get(itemId);

        if (!promise) {

            promise = window.shelf.getThumbnail(itemId);

            state.thumbnailPromises.set(itemId, promise);

            if (
                state.thumbnailPromises.size >
                state.maxThumbnailPromises
            ) {

                const oldestKey =
                    state.thumbnailPromises.keys().next().value;

                state.thumbnailPromises.delete(oldestKey);
            }
        }

        const result = await promise;

        if (!result?.dataUrl) return;

        if (!imageElement.isConnected) return;

        imageElement.src = result.dataUrl;

        imageElement.onload = () => {
            imageElement.classList.add("loaded");
        };

        imageElement.onerror = () => {
            imageElement.remove();
        };

    } catch (error) {

        console.warn("Thumbnail unavailable:", error);

        if (imageElement.isConnected) {
            imageElement.remove();
        }
    }
}


/* =========================================
   ADD FILES
========================================= */

async function addFiles() {

    try {

        const paths = await window.shelf.selectFiles();

        if (!Array.isArray(paths) || paths.length === 0) {
            return;
        }

        let added = 0;
        let duplicates = 0;

        for (const filePath of paths) {

            if (!filePath) continue;

            if (isDuplicate("file", filePath)) {
                duplicates++;
                continue;
            }

            const item = {
                id: generateId(),
                type: "file",
                value: filePath,
                name: getFileName(filePath),

                collectionId:
                    state.activeView === "collection"
                        ? state.activeCollection
                        : QUICK_ACCESS_ID,

                createdAt: new Date().toISOString()
            };

            state.items.unshift(item);

            added++;
        }

        if (added > 0) {

            renderCollections();

            render();

            await sync();
        }

        if (added > 0 && duplicates > 0) {
            showToast(`${added} added · ${duplicates} duplicates skipped.`);
        } else if (added > 0) {
            showToast(`${added} file${added === 1 ? "" : "s"} added.`);
        } else {
            showToast("These files are already on your shelf.");
        }

    } catch (error) {

        console.error("Add files failed:", error);

        showToast(error.message || "Unable to add files.");
    }
}


elements.addFiles.addEventListener("click", addFiles);

elements.emptyAddFiles.addEventListener("click", addFiles);


/* =========================================
   ADD ITEM
========================================= */

async function addItem(type, value, name) {

    if (!value) return false;

    if (isDuplicate(type, value)) {
        showToast("Already on your shelf.");
        return false;
    }

    const item = {
        id: generateId(),
        type,
        value,
        name: name || (
            type === "link"
                ? value
                : type === "text"
                    ? "Pasted Text"
                    : getFileName(value)
        ),

        collectionId:
            state.activeView === "collection"
                ? state.activeCollection
                : QUICK_ACCESS_ID,

        createdAt: new Date().toISOString()
    };

    state.items.unshift(item);

    renderCollections();

    render();

    await sync();

    return true;
}


/* =========================================
   CLIPBOARD
========================================= */

async function pasteFromClipboard() {

    try {

        const value = await navigator.clipboard.readText();

        if (!value || !value.trim()) {
            showToast("Clipboard is empty.");
            return;
        }

        const content = value.trim();

        if (isValidURL(content)) {

            const added = await addItem(
                "link",
                content,
                content
            );

            if (added) {
                showToast("Link added to shelf.");
            }

        } else {

            const added = await addItem(
                "text",
                content,
                content.length > 40
                    ? `${content.slice(0, 40)}...`
                    : content
            );

            if (added) {
                showToast("Text added to shelf.");
            }
        }

    } catch (error) {

        console.error(error);

        showToast(
            "Clipboard access unavailable. Try Ctrl + V."
        );
    }
}


elements.pasteButton.addEventListener(
    "click",
    pasteFromClipboard
);


/* =========================================
   DRAG AND DROP
========================================= */

let dragDepth = 0;


function preventDragDefaults(event) {
    event.preventDefault();
    event.stopPropagation();
}


document.addEventListener("dragenter", event => {

    preventDragDefaults(event);

    dragDepth++;

    elements.dropZone.classList.add("drag-over");
});


document.addEventListener("dragover", event => {

    event.preventDefault();

    event.dataTransfer.dropEffect = "copy";
});


document.addEventListener("dragleave", event => {

    preventDragDefaults(event);

    dragDepth--;

    if (dragDepth <= 0) {

        dragDepth = 0;

        elements.dropZone.classList.remove("drag-over");
    }
});


document.addEventListener("drop", async event => {

    preventDragDefaults(event);

    dragDepth = 0;

    elements.dropZone.classList.remove("drag-over");

    const files = Array.from(
        event.dataTransfer?.files || []
    );

    let added = 0;

    for (const file of files) {

        try {

            const filePath = window.shelf.pathOf(file);

            if (!filePath) continue;

            if (isDuplicate("file", filePath)) {
                continue;
            }

            state.items.unshift({
                id: generateId(),
                type: "file",
                value: filePath,
                name: file.name || getFileName(filePath),

                collectionId:
                    state.activeView === "collection"
                        ? state.activeCollection
                        : QUICK_ACCESS_ID,

                createdAt: new Date().toISOString()
            });

            added++;

        } catch (error) {

            console.warn("Could not import dropped file:", error);
        }
    }


    if (added > 0) {

        renderCollections();

        render();

        await sync();

        showToast(`${added} file${added === 1 ? "" : "s"} added.`);

        return;
    }


    const uriList = event.dataTransfer.getData("text/uri-list");

    const plainText = event.dataTransfer.getData("text/plain");

    const value = uriList || plainText;

    if (value) {

        const content = value
            .split("\n")
            .map(line => line.trim())
            .find(line => line && !line.startsWith("#"));

        if (content && isValidURL(content)) {

            const success = await addItem(
                "link",
                content,
                content
            );

            if (success) {
                showToast("Link added.");
            }

            return;
        }

        if (content) {

            const success = await addItem(
                "text",
                content,
                "Dropped Text"
            );

            if (success) {
                showToast("Text added.");
            }
        }
    }
});


/* =========================================
   CONTEXT MENU
========================================= */

function showContextMenu(item, event) {

    state.currentMenuItem = item;

    const menu = elements.contextMenu;

    const menuWidth = 190;
    const menuHeight = 260;

    let x = event.clientX;
    let y = event.clientY;

    if (x + menuWidth > window.innerWidth) {
        x = window.innerWidth - menuWidth - 10;
    }

    if (y + menuHeight > window.innerHeight) {
        y = window.innerHeight - menuHeight - 10;
    }

    menu.style.left = `${Math.max(5, x)}px`;
    menu.style.top = `${Math.max(5, y)}px`;

    const revealButton = menu.querySelector(
        '[data-action="reveal"]'
    );

    const locateButton = menu.querySelector(
        '[data-action="locate"]'
    );

    revealButton.style.display =
        item.type === "file" ? "flex" : "none";

    locateButton.style.display =
        item.type === "file" ? "flex" : "none";

    menu.classList.add("show");

    elements.menuBackdrop.classList.add("show");
}


function hideContextMenu() {

    elements.contextMenu.classList.remove("show");

    elements.menuBackdrop.classList.remove("show");

    state.currentMenuItem = null;
}


elements.menuBackdrop.addEventListener(
    "click",
    hideContextMenu
);


elements.contextMenu.addEventListener(
    "click",
    async event => {

        const button = event.target.closest("[data-action]");

        if (!button) return;

        const action = button.dataset.action;

        const item = state.currentMenuItem;

        if (!item) return;

        hideContextMenu();

        try {

            switch (action) {

                case "open":

                    await window.shelf.openFile(item.id);

                    break;


                case "reveal":

                    await window.shelf.revealFile(item.id);

                    break;


                case "copy":

                    await navigator.clipboard.writeText(
                        item.value
                    );

                    showToast("Copied to clipboard.");

                    break;


                case "rename":

                    await renameItem(item);

                    break;


                case "locate":

                    await locateItem(item);

                    break;


                case "remove":

                    await removeItem(item);

                    break;
            }

        } catch (error) {

            console.error(error);

            showToast(error.message || "Action failed.");
        }
    }
);


/* =========================================
   RENAME ITEM
========================================= */

async function renameItem(item) {

    const name = prompt(
        "Enter a new display name:",
        item.name
    );

    if (!name || !name.trim()) return;

    const result = await window.shelf.renameItem(
        item.id,
        name.trim()
    );

    if (result?.success === false) {
        throw new Error(result.error || "Could not rename item.");
    }

    item.name = name.trim();

    render();

    showToast("Item renamed.");
}


/* =========================================
   LOCATE MISSING FILE
========================================= */

async function locateItem(item) {

    const result = await window.shelf.locateFile(item.id);

    if (result?.success === false) {
        throw new Error(result.error || "Could not locate file.");
    }

    await refreshData();

    showToast("File location updated.");
}


/* =========================================
   REMOVE ITEM
========================================= */

async function removeItem(item) {

    const confirmed = confirm(
        `Remove "${item.name}" from your shelf?\n\nThe original file will not be deleted.`
    );

    if (!confirmed) return;

    state.items = state.items.filter(
        existing => existing.id !== item.id
    );

    state.thumbnailPromises.delete(item.id);

    renderCollections();

    render();

    await sync();

    showToast("Removed from shelf.");
}


/* =========================================
   PREVIEW MODAL
========================================= */

async function openPreview(item) {

    state.currentPreviewItem = item;

    elements.previewTitle.textContent = item.name || "Preview";

    elements.previewBackdrop.classList.add("show");

    elements.previewBody.innerHTML = `
        <div class="preview-loading">
            Loading preview...
        </div>
    `;

    elements.previewCopy.textContent =
        item.type === "text"
            ? "Copy Text"
            : "Copy Path";

    elements.previewOpen.style.display =
        item.type === "text"
            ? "none"
            : "block";

    try {

        if (item.type === "link") {

            elements.previewBody.innerHTML = `
                <div class="preview-info">

                    <div class="preview-info-row">
                        <span>Type</span>
                        <span>Website Link</span>
                    </div>

                    <div class="preview-info-row">
                        <span>URL</span>
                        <span>${escapeHTML(item.value)}</span>
                    </div>

                </div>
            `;

            return;
        }


        if (item.type === "text") {

            elements.previewBody.innerHTML = `
                <pre>${escapeHTML(item.value)}</pre>
            `;

            return;
        }


        if (item.type === "file" && isImage(item)) {

            const result = await window.shelf.getImagePreview(
                item.id
            );

            if (!elements.previewBackdrop.classList.contains("show")) {
                return;
            }

            if (!result?.dataUrl) {
                throw new Error("Image preview unavailable.");
            }

            const image = document.createElement("img");

            image.src = result.dataUrl;

            image.alt = item.name || "Image preview";

            elements.previewBody.replaceChildren(image);

            return;
        }


        if (
            item.type === "file" &&
            [
                ".txt",
                ".md",
                ".json",
                ".csv",
                ".log"
            ].includes(getItemExtension(item))
        ) {

            const result = await window.shelf.readTextFile(
                item.id
            );

            elements.previewBody.innerHTML = `
                <pre>${escapeHTML(result.text || "")}</pre>
            `;

            return;
        }


        if (item.type === "file") {

            const info = await window.shelf.getFileInfo(
                item.id
            );

            const rows = [
                ["Name", info.name],
                ["Extension", info.extension || "Unknown"],
                ["Size", formatFileSize(info.size)],
                ["Modified", info.modified || "Unknown"],
                ["Created", info.created || "Unknown"],
                ["Location", info.location || item.value]
            ];

            elements.previewBody.innerHTML = `
                <div class="preview-info">
                    ${rows.map(([label, value]) => `
                        <div class="preview-info-row">
                            <span>${escapeHTML(label)}</span>
                            <span>${escapeHTML(value)}</span>
                        </div>
                    `).join("")}
                </div>
            `;

            return;
        }

    } catch (error) {

        console.error("Preview failed:", error);

        elements.previewBody.innerHTML = `
            <div class="preview-error">
                ${escapeHTML(error.message || "Unable to load preview.")}
            </div>
        `;
    }
}


function closePreview() {

    elements.previewBackdrop.classList.remove("show");

    state.currentPreviewItem = null;
}


elements.previewClose.addEventListener(
    "click",
    closePreview
);


elements.previewBackdrop.addEventListener(
    "click",
    event => {

        if (event.target === elements.previewBackdrop) {
            closePreview();
        }
    }
);


elements.previewCopy.addEventListener(
    "click",
    async () => {

        const item = state.currentPreviewItem;

        if (!item) return;

        try {

            await navigator.clipboard.writeText(
                item.value
            );

            showToast(
                item.type === "text"
                    ? "Text copied."
                    : "Copied to clipboard."
            );

        } catch (error) {

            console.error(error);

            showToast("Unable to copy.");
        }
    }
);


elements.previewOpen.addEventListener(
    "click",
    async () => {

        const item = state.currentPreviewItem;

        if (!item || item.type === "text") return;

        try {

            await window.shelf.openFile(item.id);

        } catch (error) {

            console.error(error);

            showToast(error.message || "Unable to open item.");
        }
    }
);


/* =========================================
   KEYBOARD SHORTCUTS
========================================= */

document.addEventListener("keydown", async event => {

    const key = event.key.toLowerCase();

    const isMac = navigator.platform
        .toLowerCase()
        .includes("mac");

    const modifier = isMac
        ? event.metaKey
        : event.ctrlKey;


    if (event.key === "Escape") {

        hideContextMenu();

        closePreview();

        return;
    }


    if (modifier && key === "k") {

        event.preventDefault();

        elements.search.focus();

        elements.search.select();

        return;
    }


    if (modifier && key === "v") {

        if (isEditableElement(document.activeElement)) {
            return;
        }

        event.preventDefault();

        await pasteFromClipboard();
    }
});


/* =========================================
   COLLECTION BUTTON
========================================= */

elements.addCollection.addEventListener(
    "click",
    createCollection
);


/* =========================================
   INITIALIZATION
========================================= */

async function initialize() {

    console.log("Drag Shelf initializing...");

    if (!window.shelf) {

        console.error("Drag Shelf preload API unavailable.");

        showToast("Application bridge unavailable.");

        return;
    }

    initializeThumbnailObserver();

    await refreshData();

    console.log("Drag Shelf ready.");
}


initialize().catch(error => {

    console.error("Initialization failed:", error);

    showToast("Drag Shelf failed to initialize.");
});