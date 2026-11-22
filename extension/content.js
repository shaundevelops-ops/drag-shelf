(() => {
  if (window.__dragShelfSmartUploadInstalled) return;
  window.__dragShelfSmartUploadInstalled = true;

  const API = "http://127.0.0.1:32145";
  const TOKEN = "ds-local-7f2c91a8e4b64c0b9d3e6a1f5c8b204d";
  const headers = { "X-Drag-Shelf-Token": TOKEN };
  let activeInput = null;
  let panel = null;
  let filesCache = [];

  const style = document.createElement("style");
  style.textContent = `
    #drag-shelf-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(10,12,25,.48);display:flex;align-items:center;justify-content:center;font:14px system-ui,sans-serif}
    #drag-shelf-panel{width:min(540px,92vw);max-height:82vh;background:#f8f8fc;color:#171727;border-radius:16px;box-shadow:0 24px 90px #0007;overflow:hidden;display:flex;flex-direction:column}
    #ds-head{background:#4f46e5;color:white;padding:15px 18px;display:flex;align-items:center;gap:12px}
    #ds-head strong{font-size:16px;flex:1}#ds-close{border:0;border-radius:8px;padding:6px 10px;cursor:pointer}
    #ds-tools{padding:12px 16px;display:flex;gap:8px}#ds-search{flex:1;min-width:0;border:1px solid #ddd;border-radius:8px;padding:9px}
    #ds-files{overflow:auto;padding:0 16px 14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:9px}
    .ds-file{border:1px solid #ddd;background:white;border-radius:10px;padding:10px;text-align:left;cursor:pointer;min-width:0}
    .ds-file.selected{outline:2px solid #4f46e5;background:#eeeeff;border-color:#4f46e5}
    .ds-thumb{height:78px;display:flex;align-items:center;justify-content:center;font-size:30px;margin-bottom:7px;overflow:hidden}
    .ds-thumb img{max-width:100%;max-height:78px;object-fit:contain}.ds-name{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #ds-foot{padding:12px 16px;border-top:1px solid #e4e4ed;display:flex;align-items:center;gap:8px}
    #ds-status{font-size:12px;color:#666;flex:1}#ds-attach{background:#4f46e5;color:white;border:0;border-radius:8px;padding:10px 14px;font-weight:600;cursor:pointer}
    #ds-attach:disabled{opacity:.45;cursor:not-allowed}#ds-cancel{background:#e9e9ef;border:0;border-radius:8px;padding:10px 14px;cursor:pointer}
    #ds-empty{grid-column:1/-1;text-align:center;color:#666;padding:35px 10px}
  `;
  (document.head || document.documentElement).appendChild(style);

  function closePanel() {
    panel?.remove();
    panel = null;
    activeInput = null;
  }

  async function loadFiles() {
    const response = await fetch(`${API}/api/files`, {cache:"no-store", headers});
    if (!response.ok) throw new Error(`Drag Shelf is unavailable (${response.status})`);
    return response.json();
  }

  function openPanel(input) {
    activeInput = input;
    if (panel) panel.remove();

    panel = document.createElement("div");
    panel.id = "drag-shelf-overlay";
    panel.innerHTML = `
      <section id="drag-shelf-panel" role="dialog" aria-modal="true" aria-label="Choose from Drag Shelf">
        <header id="ds-head"><strong>📥 Choose from Drag Shelf</strong><button id="ds-close" type="button">✕</button></header>
        <div id="ds-tools"><input id="ds-search" type="search" placeholder="Search your shelf…"></div>
        <div id="ds-files"><div id="ds-empty">Loading your shelf…</div></div>
        <footer id="ds-foot"><span id="ds-status">Select one or more files</span><button id="ds-cancel" type="button">Cancel</button><button id="ds-attach" type="button" disabled>Attach files</button></footer>
      </section>`;
    document.documentElement.appendChild(panel);

    panel.addEventListener("click", e => { if (e.target === panel) closePanel(); });
    panel.querySelector("#ds-close").onclick = closePanel;
    panel.querySelector("#ds-cancel").onclick = closePanel;
    panel.querySelector("#ds-search").addEventListener("input", renderFiles);
    panel.querySelector("#ds-attach").onclick = attachSelected;

    loadFiles().then(files => {
      filesCache = Array.isArray(files) ? files : [];
      renderFiles();
    }).catch(err => {
      panel.querySelector("#ds-files").innerHTML =
        `<div id="ds-empty">${escapeHtml(err.message)}<br><br>Open the Drag Shelf desktop app and add files first.</div>`;
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }

  function renderFiles() {
    if (!panel) return;
    const query = panel.querySelector("#ds-search").value.toLowerCase();
    const grid = panel.querySelector("#ds-files");
    const selected = new Set([...grid.querySelectorAll(".selected")].map(el => el.dataset.id));
    grid.textContent = "";
    const filtered = filesCache.filter(f => f.name.toLowerCase().includes(query));
    if (!filtered.length) {
      grid.innerHTML = `<div id="ds-empty">${filesCache.length ? "No matching files." : "Your Drag Shelf is empty. Add files in the desktop app first."}</div>`;
    }
    for (const file of filtered) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "ds-file";
      card.dataset.id = file.id;
      if (selected.has(file.id)) card.classList.add("selected");
      const thumb = document.createElement("div");
      thumb.className = "ds-thumb";
      if (file.isImage) {
        const img = document.createElement("img");
        img.alt = "";
        img.src = `${API}/api/thumbnail/${encodeURIComponent(file.id)}`;
        thumb.appendChild(img);
      } else {
        thumb.textContent = file.icon || "📄";
      }
      const name = document.createElement("div");
      name.className = "ds-name";
      name.textContent = file.name;
      card.append(thumb, name);
      card.onclick = () => {
        card.classList.toggle("selected");
        const count = grid.querySelectorAll(".selected").length;
        panel.querySelector("#ds-status").textContent = `${count} file${count === 1 ? "" : "s"} selected`;
        panel.querySelector("#ds-attach").disabled = count === 0;
      };
      grid.appendChild(card);
    }
  }

  async function attachSelected() {
    const ids = [...panel.querySelectorAll(".ds-file.selected")].map(el => el.dataset.id);
    if (!ids.length || !activeInput) return;
    const button = panel.querySelector("#ds-attach");
    button.disabled = true;
    button.textContent = "Attaching…";
    try {
      const transfer = new DataTransfer();
      for (const id of ids) {
        const response = await fetch(`${API}/api/file/${encodeURIComponent(id)}`, {headers});
        if (!response.ok) throw new Error("Could not read a selected shelf file.");
        const blob = await response.blob();
        const meta = filesCache.find(f => f.id === id);
        const file = new File([blob], meta?.name || "shelf-file", {
          type: blob.type || meta?.mime || "application/octet-stream",
          lastModified: meta?.lastModified || Date.now()
        });
        transfer.items.add(file);
      }
      if (!activeInput.multiple && transfer.files.length > 1) {
        throw new Error("This upload field accepts only one file. Select one file.");
      }
      activeInput.files = transfer.files;
      activeInput.dispatchEvent(new Event("input", {bubbles:true}));
      activeInput.dispatchEvent(new Event("change", {bubbles:true}));
      closePanel();
    } catch (error) {
      panel.querySelector("#ds-status").textContent = error.message;
      button.disabled = false;
      button.textContent = "Attach files";
    }
  }

  // Intercept native file input activation. The browser's native picker is
  // suppressed and replaced by the Drag Shelf chooser.
  document.addEventListener("click", event => {
    const input = event.target instanceof HTMLInputElement && event.target.type === "file"
      ? event.target
      : null;
    if (!input) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openPanel(input);
  }, true);

  // Also catches programmatic input.click() calls made by many upload buttons.
  const originalClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function() {
    if (this.type === "file") {
      openPanel(this);
      return;
    }
    return originalClick.call(this);
  };

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && panel) closePanel();
  });
})();