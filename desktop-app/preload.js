"use strict";

const {
    contextBridge,
    ipcRenderer,
    webUtils
} = require("electron");

contextBridge.exposeInMainWorld("shelf", {

    // ====================================
    // FILE PICKER / DRAGGING
    // ====================================

    selectFiles: () =>
        ipcRenderer.invoke("select-files"),

    pathOf: file =>
        webUtils.getPathForFile(file),

    dragOut: filePath =>
        ipcRenderer.send("drag-out", filePath),

    // ====================================
    // SHELF STORAGE
    // ====================================

    getItems: () =>
        ipcRenderer.invoke("shelf:get-items"),

    updateItems: items =>
        ipcRenderer.invoke("shelf:update-items", items),

    // ====================================
    // COLLECTIONS
    // ====================================

    getCollections: () =>
        ipcRenderer.invoke("shelf:get-collections"),

    createCollection: name =>
        ipcRenderer.invoke("collection:create", name),

    renameCollection: (id, name) =>
        ipcRenderer.invoke("collection:rename", id, name),

    deleteCollection: id =>
        ipcRenderer.invoke("collection:delete", id),

    moveItem: (itemId, collectionId) =>
        ipcRenderer.invoke(
            "collection:move-item",
            itemId,
            collectionId
        ),

    // ====================================
    // FILE MANAGEMENT
    // ====================================

    openFile: id =>
        ipcRenderer.invoke("file:open", id),

    revealFile: id =>
        ipcRenderer.invoke("file:reveal", id),

    renameItem: (id, name) =>
        ipcRenderer.invoke("file:rename", id, name),

    checkFile: id =>
        ipcRenderer.invoke("file:check", id),

    locateFile: id =>
        ipcRenderer.invoke("file:locate", id),

    // ====================================
    // PREVIEW
    // ====================================

    getFileInfo: id =>
        ipcRenderer.invoke("file:get-info", id),

    getImagePreview: id =>
        ipcRenderer.invoke("file:get-image-preview", id),

    readTextFile: id =>
        ipcRenderer.invoke("file:read-text", id),

    // ====================================
    // THUMBNAILS
    // ====================================

    getThumbnail: id =>
        ipcRenderer.invoke("file:get-thumbnail", id)

});