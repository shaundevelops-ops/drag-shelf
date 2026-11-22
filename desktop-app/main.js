"use strict";

const {
    app,
    BrowserWindow,
    ipcMain,
    globalShortcut,
    nativeImage,
    dialog,
    shell
} = require("electron");

const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");

let win = null;
let shelfItems = [];
let collections = [];
let bridgeServer = null;

const PORT = 32145;

// Existing prototype bridge token.
// Keep this identical to the token used by your browser extension.
const BRIDGE_TOKEN = "ds-local-7f2c91a8e4b64c0b9d3e6a1f5c8b204d";

const DEFAULT_COLLECTIONS = [
    { id: "quick-access", name: "Quick Access" },
    { id: "college", name: "College" },
    { id: "projects", name: "Projects" },
    { id: "work", name: "Work" },
    { id: "personal", name: "Personal" }
];

const SHELF_FILE = () =>
    path.join(app.getPath("userData"), "shelf-data.json");

const THUMBNAIL_CACHE_DIR = () =>
    path.join(app.getPath("userData"), "thumbnail-cache");

const IMAGE_MIME_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp"
};

const TEXT_EXTENSIONS = [
    ".txt",
    ".md",
    ".json",
    ".csv",
    ".log"
];

// ========================================
// UTILITIES
// ========================================

function createId() {
    return crypto.randomUUID();
}

function isValidItem(item) {
    return Boolean(
        item &&
        ["file", "link", "text"].includes(item.type) &&
        typeof item.value === "string" &&
        item.value.length > 0
    );
}

function normalizeItem(item) {
    if (!isValidItem(item)) return null;

    return {
        id: typeof item.id === "string" ? item.id : createId(),
        type: item.type,
        value: item.value,
        name: String(item.name || item.value),
        collectionId: collections.some(
            collection => collection.id === item.collectionId
        )
            ? item.collectionId
            : "quick-access",
        createdAt: item.createdAt || new Date().toISOString()
    };
}

function fileId(filePath) {
    return crypto
        .createHash("sha256")
        .update(filePath)
        .digest("hex");
}

function getShelfItem(itemId) {
    return shelfItems.find(item => item.id === itemId);
}

function getPreviewFile(itemId) {
    const item = getShelfItem(itemId);

    if (!item || item.type !== "file") {
        throw new Error("File not found in Drag Shelf.");
    }

    if (!fs.existsSync(item.value)) {
        throw new Error("This file no longer exists.");
    }

    const stat = fs.statSync(item.value);

    if (!stat.isFile()) {
        throw new Error("Invalid file.");
    }

    return {
        item,
        stat,
        extension: path.extname(item.value).toLowerCase()
    };
}

// ========================================
// STORAGE
// ========================================

function saveShelf() {
    const file = SHELF_FILE();
    const temporaryFile = `${file}.tmp`;

    const data = {
        version: 3,
        collections,
        items: shelfItems
    };

    try {
        fs.mkdirSync(path.dirname(file), {
            recursive: true
        });

        fs.writeFileSync(
            temporaryFile,
            JSON.stringify(data, null, 2),
            "utf8"
        );

        fs.renameSync(temporaryFile, file);

        return true;
    } catch (error) {
        console.error("Storage error:", error);

        try {
            if (fs.existsSync(temporaryFile)) {
                fs.unlinkSync(temporaryFile);
            }
        } catch {
            // Ignore temporary-file cleanup errors.
        }

        throw new Error("Unable to save Drag Shelf data.");
    }
}

function loadShelf() {
    collections = DEFAULT_COLLECTIONS.map(item => ({ ...item }));
    shelfItems = [];

    const file = SHELF_FILE();

    if (!fs.existsSync(file)) {
        saveShelf();
        return;
    }

    try {
        const parsed = JSON.parse(
            fs.readFileSync(file, "utf8")
        );

        // Migrate legacy array storage.
        if (Array.isArray(parsed)) {
            shelfItems = parsed
                .filter(isValidItem)
                .map(item => ({
                    ...item,
                    id: item.id || createId(),
                    collectionId: "quick-access",
                    createdAt: item.createdAt || new Date().toISOString()
                }));

            saveShelf();

            console.log("Legacy shelf data migrated.");
            return;
        }

        if (parsed && typeof parsed === "object") {
            if (Array.isArray(parsed.collections)) {
                for (const saved of parsed.collections) {
                    if (
                        !saved ||
                        typeof saved.id !== "string" ||
                        typeof saved.name !== "string"
                    ) {
                        continue;
                    }

                    const existing = collections.find(
                        item => item.id === saved.id
                    );

                    if (existing) {
                        existing.name = saved.name;
                    } else {
                        collections.push({
                            id: saved.id,
                            name: saved.name
                        });
                    }
                }
            }

            if (Array.isArray(parsed.items)) {
                shelfItems = parsed.items
                    .filter(isValidItem)
                    .map(normalizeItem)
                    .filter(Boolean);
            }
        }

        saveShelf();

        console.log(
            `Loaded ${shelfItems.length} items and ${collections.length} collections.`
        );

    } catch (error) {
        console.error("Could not load shelf:", error);

        // Preserve the damaged file rather than overwriting it.
        const backupPath = `${file}.corrupt-${Date.now()}`;

        try {
            fs.copyFileSync(file, backupPath);
            console.error("Damaged storage backed up to:", backupPath);
        } catch (backupError) {
            console.error("Backup failed:", backupError);
        }

        throw new Error(
            "Drag Shelf could not read its saved data. A backup was attempted."
        );
    }
}

// ========================================
// COLLECTION MANAGEMENT
// ========================================

function createCollection(name) {
    const cleanName = String(name || "").trim();

    if (!cleanName) {
        throw new Error("Collection name cannot be empty.");
    }

    if (collections.some(
        item => item.name.toLowerCase() === cleanName.toLowerCase()
    )) {
        throw new Error("A collection with that name already exists.");
    }

    const collection = {
        id: createId(),
        name: cleanName
    };

    collections.push(collection);
    saveShelf();

    return collection;
}

function renameCollection(id, name) {
    const collection = collections.find(item => item.id === id);

    if (!collection) {
        throw new Error("Collection not found.");
    }

    const cleanName = String(name || "").trim();

    if (!cleanName) {
        throw new Error("Collection name cannot be empty.");
    }

    if (collections.some(
        item =>
            item.id !== id &&
            item.name.toLowerCase() === cleanName.toLowerCase()
    )) {
        throw new Error("That collection name is already being used.");
    }

    collection.name = cleanName;
    saveShelf();

    return collection;
}

function deleteCollection(id) {
    if (id === "quick-access") {
        throw new Error("Quick Access cannot be deleted.");
    }

    if (!collections.some(item => item.id === id)) {
        throw new Error("Collection not found.");
    }

    shelfItems = shelfItems.map(item => ({
        ...item,
        collectionId:
            item.collectionId === id
                ? "quick-access"
                : item.collectionId
    }));

    collections = collections.filter(item => item.id !== id);

    saveShelf();

    return true;
}

function moveItem(itemId, collectionId) {
    const item = getShelfItem(itemId);

    if (!item) {
        throw new Error("Item not found.");
    }

    if (!collections.some(item => item.id === collectionId)) {
        throw new Error("Collection not found.");
    }

    item.collectionId = collectionId;

    saveShelf();

    return item;
}

// ========================================
// FILE HELPERS
// ========================================

function getExistingFileItem(id) {
    return shelfItems.find(item => {
        try {
            return (
                item.type === "file" &&
                fileId(item.value) === id &&
                fs.existsSync(item.value) &&
                fs.statSync(item.value).isFile()
            );
        } catch {
            return false;
        }
    });
}

function validateFilePath(filePath) {
    if (typeof filePath !== "string" || !filePath.trim()) {
        throw new Error("Invalid file path.");
    }

    if (!fs.existsSync(filePath)) {
        throw new Error("This file no longer exists.");
    }

    if (!fs.statSync(filePath).isFile()) {
        throw new Error("Invalid file.");
    }

    return filePath;
}

// ========================================
// THUMBNAIL CACHE
// ========================================

function getThumbnailCacheKey(filePath, stat) {
    return crypto
        .createHash("sha256")
        .update(`${filePath}:${stat.size}:${stat.mtimeMs}`)
        .digest("hex");
}

function cleanupThumbnailCache(maxBytes = 250 * 1024 * 1024) {
    const directory = THUMBNAIL_CACHE_DIR();

    if (!fs.existsSync(directory)) return;

    try {
        const entries = fs.readdirSync(directory)
            .map(name => {
                const fullPath = path.join(directory, name);

                try {
                    const stat = fs.statSync(fullPath);

                    return {
                        path: fullPath,
                        size: stat.size,
                        modified: stat.mtimeMs
                    };
                } catch {
                    return null;
                }
            })
            .filter(Boolean)
            .sort((a, b) => a.modified - b.modified);

        let total = entries.reduce(
            (sum, entry) => sum + entry.size,
            0
        );

        for (const entry of entries) {
            if (total <= maxBytes) break;

            try {
                fs.unlinkSync(entry.path);
                total -= entry.size;
            } catch (error) {
                console.warn("Cache cleanup failed:", error);
            }
        }
    } catch (error) {
        console.warn("Thumbnail cache cleanup failed:", error);
    }
}

// ========================================
// LOCAL HTTP BRIDGE
// ========================================

function sendJson(res, status, data) {
    if (res.destroyed) return;

    res.writeHead(status, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers":
            "Content-Type, X-Drag-Shelf-Token",
        "Cache-Control": "no-store"
    });

    res.end(JSON.stringify(data));
}

function startLocalBridge() {
    bridgeServer = http.createServer((req, res) => {
        if (req.method === "OPTIONS") {
            res.writeHead(204, {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers":
                    "Content-Type, X-Drag-Shelf-Token"
            });

            return res.end();
        }

        if (
            req.headers["x-drag-shelf-token"] !== BRIDGE_TOKEN
        ) {
            return sendJson(res, 401, {
                error: "Unauthorized"
            });
        }

        if (req.method !== "GET") {
            return sendJson(res, 405, {
                error: "Method not allowed"
            });
        }

        const url = new URL(
            req.url,
            `http://127.0.0.1:${PORT}`
        );

        // FILE LIST
        if (url.pathname === "/api/files") {
            const files = [];

            for (const item of shelfItems) {
                if (item.type !== "file") continue;

                try {
                    const stat = fs.statSync(item.value);

                    if (!stat.isFile()) continue;

                    const extension = path.extname(
                        item.value
                    ).toLowerCase();

                    const mimeMap = {
                        ...IMAGE_MIME_TYPES,
                        ".svg": "image/svg+xml",
                        ".pdf": "application/pdf",
                        ".txt": "text/plain",
                        ".json": "application/json",
                        ".mp4": "video/mp4"
                    };

                    files.push({
                        id: fileId(item.value),
                        name: item.name || path.basename(item.value),
                        mime: mimeMap[extension] ||
                            "application/octet-stream",
                        isImage: Boolean(
                            IMAGE_MIME_TYPES[extension] ||
                            extension === ".svg"
                        ),
                        icon: extension === ".pdf" ? "📕" : "📄",
                        lastModified: stat.mtimeMs
                    });
                } catch {
                    // Ignore missing files.
                }
            }

            return sendJson(res, 200, files);
        }

        // FILE OR THUMBNAIL
        const match = url.pathname.match(
            /^\/api\/(file|thumbnail)\/([a-f0-9]{64})$/
        );

        if (match) {
            const item = getExistingFileItem(match[2]);

            if (!item) {
                return sendJson(res, 404, {
                    error: "File not found."
                });
            }

            const extension = path.extname(
                item.value
            ).toLowerCase();

            const mimeMap = {
                ...IMAGE_MIME_TYPES,
                ".svg": "image/svg+xml",
                ".pdf": "application/pdf"
            };

            res.writeHead(200, {
                "Content-Type": mimeMap[extension] ||
                    "application/octet-stream",
                "Content-Disposition": "inline",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff"
            });

            const stream = fs.createReadStream(item.value);

            stream.on("error", error => {
                console.error("Bridge stream error:", error);

                if (!res.headersSent) {
                    sendJson(res, 500, {
                        error: "Unable to read file."
                    });
                } else {
                    res.destroy(error);
                }
            });

            return stream.pipe(res);
        }

        return sendJson(res, 404, {
            error: "Not found."
        });
    });

    bridgeServer.on("error", error => {
        console.error("Bridge error:", error);
    });

    bridgeServer.listen(PORT, "127.0.0.1", () => {
        console.log(`Drag Shelf bridge running on ${PORT}`);
    });
}

// ========================================
// WINDOW
// ========================================

function createWindow() {
    win = new BrowserWindow({
        width: 1050,
        height: 720,
        minWidth: 760,
        minHeight: 560,
        alwaysOnTop: true,
        title: "Drag Shelf",
        autoHideMenuBar: true,
        backgroundColor: "#090b0f",

        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    win.setAlwaysOnTop(true, "floating");

    win.loadFile(path.join(__dirname, "index.html"));

    win.on("closed", () => {
        win = null;
    });
}

// ========================================
// IPC — SHELF
// ========================================

ipcMain.handle("shelf:get-items", () => {
    return shelfItems;
});

ipcMain.handle("shelf:get-collections", () => {
    return collections;
});

ipcMain.handle("shelf:update-items", (_event, payload) => {
    const incoming = Array.isArray(payload)
        ? payload
        : payload?.items;

    if (!Array.isArray(incoming)) {
        throw new Error("Invalid shelf items.");
    }

    const normalized = incoming
        .filter(isValidItem)
        .map(normalizeItem)
        .filter(Boolean);

    // Avoid accidental duplicate IDs.
    const seenIds = new Set();

    shelfItems = normalized.filter(item => {
        if (seenIds.has(item.id)) return false;

        seenIds.add(item.id);
        return true;
    });

    saveShelf();

    return {
        success: true,
        count: shelfItems.length
    };
});

// ========================================
// IPC — COLLECTIONS
// ========================================

ipcMain.handle("collection:create", (_event, name) => {
    return createCollection(name);
});

ipcMain.handle("collection:rename", (_event, id, name) => {
    return renameCollection(id, name);
});

ipcMain.handle("collection:delete", (_event, id) => {
    return deleteCollection(id);
});

ipcMain.handle(
    "collection:move-item",
    (_event, itemId, collectionId) => {
        return moveItem(itemId, collectionId);
    }
);

// ========================================
// IPC — FILE PICKER
// ========================================

ipcMain.handle("select-files", async () => {
    const result = await dialog.showOpenDialog(win, {
        title: "Add Files to Drag Shelf",
        properties: ["openFile", "multiSelections"]
    });

    if (result.canceled) return [];

    return result.filePaths;
});

// ========================================
// IPC — FILE DRAGGING
// ========================================

ipcMain.on("drag-out", (event, filePath) => {
    try {
        validateFilePath(filePath);

        const item = shelfItems.find(
            entry =>
                entry.type === "file" &&
                entry.value === filePath
        );

        if (!item) {
            throw new Error("File is not on the shelf.");
        }

        const iconPath = path.join(
            __dirname,
            "assets",
            "icon.png"
        );

        const icon = fs.existsSync(iconPath)
            ? nativeImage.createFromPath(iconPath)
            : nativeImage.createEmpty();

        event.sender.startDrag({
            file: filePath,
            icon
        });

    } catch (error) {
        console.error("Drag-out failed:", error);
    }
});

// ========================================
// IPC — FILE MANAGEMENT
// ========================================

ipcMain.handle("file:open", async (_event, itemId) => {
    const item = getShelfItem(itemId);

    if (!item) {
        throw new Error("Item not found.");
    }

    if (item.type === "file") {
        validateFilePath(item.value);

        const error = await shell.openPath(item.value);

        if (error) throw new Error(error);

        return true;
    }

    if (item.type === "link") {
        const url = new URL(item.value);

        if (!["http:", "https:"].includes(url.protocol)) {
            throw new Error("Unsupported link protocol.");
        }

        await shell.openExternal(url.toString());

        return true;
    }

    return false;
});

ipcMain.handle("file:reveal", (_event, itemId) => {
    const item = getShelfItem(itemId);

    if (!item || item.type !== "file") {
        throw new Error("File not found.");
    }

    validateFilePath(item.value);

    shell.showItemInFolder(item.value);

    return true;
});

ipcMain.handle("file:rename", (_event, itemId, newName) => {
    const item = getShelfItem(itemId);

    if (!item) {
        throw new Error("Item not found.");
    }

    const cleanName = String(newName || "").trim();

    if (!cleanName) {
        throw new Error("Name cannot be empty.");
    }

    item.name = cleanName;

    saveShelf();

    return item;
});

ipcMain.handle("file:check", (_event, itemId) => {
    const item = getShelfItem(itemId);

    if (!item || item.type !== "file") return false;

    try {
        return fs.existsSync(item.value) &&
            fs.statSync(item.value).isFile();
    } catch {
        return false;
    }
});

ipcMain.handle("file:locate", async (_event, itemId) => {
    const item = getShelfItem(itemId);

    if (!item || item.type !== "file") {
        throw new Error("File not found.");
    }

    const result = await dialog.showOpenDialog(win, {
        title: "Locate Missing File",
        properties: ["openFile"]
    });

    if (result.canceled || !result.filePaths.length) {
        return false;
    }

    item.value = result.filePaths[0];
    item.name = path.basename(item.value);

    saveShelf();

    return true;
});

// ========================================
// IPC — FILE INFORMATION
// ========================================

ipcMain.handle("file:get-info", (_event, itemId) => {
    const { item, stat, extension } = getPreviewFile(itemId);

    return {
        name: item.name,
        extension: extension.replace(".", "").toUpperCase() || "Unknown",
        size: stat.size,
        modified: stat.mtimeMs,
        created: stat.birthtimeMs,
        location: item.value
    };
});

// ========================================
// IPC — IMAGE PREVIEW
// ========================================

ipcMain.handle("file:get-image-preview", (_event, itemId) => {
    const { item, stat, extension } = getPreviewFile(itemId);

    if (!IMAGE_MIME_TYPES[extension]) {
        throw new Error("Unsupported image format.");
    }

    const MAX_IMAGE_SIZE = 15 * 1024 * 1024;

    if (stat.size > MAX_IMAGE_SIZE) {
        throw new Error("Image is too large to preview.");
    }

    const buffer = fs.readFileSync(item.value);

    return {
        dataUrl:
            `data:${IMAGE_MIME_TYPES[extension]};base64,` +
            buffer.toString("base64")
    };
});

// ========================================
// IPC — TEXT PREVIEW
// ========================================

ipcMain.handle("file:read-text", (_event, itemId) => {
    const { item, stat, extension } = getPreviewFile(itemId);

    if (!TEXT_EXTENSIONS.includes(extension)) {
        throw new Error("Unsupported text format.");
    }

    const MAX_TEXT_SIZE = 512 * 1024;

    if (stat.size > MAX_TEXT_SIZE) {
        throw new Error("Text file is too large to preview.");
    }

    return {
        content: fs.readFileSync(item.value, "utf8")
    };
});

// ========================================
// IPC — THUMBNAILS
// ========================================

ipcMain.handle("file:get-thumbnail", (_event, itemId) => {
    const { item, stat, extension } = getPreviewFile(itemId);

    if (!IMAGE_MIME_TYPES[extension]) {
        throw new Error("Unsupported image format.");
    }

    const MAX_SOURCE_SIZE = 50 * 1024 * 1024;

    if (stat.size > MAX_SOURCE_SIZE) {
        throw new Error("Image is too large for thumbnail generation.");
    }

    const cacheDirectory = THUMBNAIL_CACHE_DIR();

    fs.mkdirSync(cacheDirectory, {
        recursive: true
    });

    const cacheKey = getThumbnailCacheKey(item.value, stat);

    const thumbnailPath = path.join(
        cacheDirectory,
        `${cacheKey}.png`
    );

    if (fs.existsSync(thumbnailPath)) {
        const cached = fs.readFileSync(thumbnailPath);

        return {
            dataUrl:
                "data:image/png;base64," +
                cached.toString("base64")
        };
    }

    const image = nativeImage.createFromPath(item.value);

    if (image.isEmpty()) {
        throw new Error("Unable to generate thumbnail.");
    }

    const thumbnail = image.resize({
        width: 160,
        height: 160,
        quality: "good"
    });

    const buffer = thumbnail.toPNG();

    fs.writeFileSync(thumbnailPath, buffer);

    // Keep the disk cache within a reasonable size.
    cleanupThumbnailCache();

    return {
        dataUrl:
            "data:image/png;base64," +
            buffer.toString("base64")
    };
});

// ========================================
// APP LIFECYCLE
// ========================================

app.whenReady().then(() => {
    try {
        loadShelf();
    } catch (error) {
        dialog.showErrorBox(
            "Drag Shelf Storage Error",
            error.message
        );

        app.quit();
        return;
    }

    createWindow();

    startLocalBridge();

    globalShortcut.register(
        "CommandOrControl+Shift+S",
        () => {
            if (!win || win.isDestroyed()) return;

            if (win.isVisible() && win.isFocused()) {
                win.hide();
            } else {
                win.show();
                win.focus();
            }
        }
    );

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("will-quit", () => {
    try {
        saveShelf();
    } catch (error) {
        console.error("Final save failed:", error);
    }

    globalShortcut.unregisterAll();

    if (bridgeServer) {
        bridgeServer.close();
        bridgeServer = null;
    }
});