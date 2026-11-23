"use strict";
// Caption drafts stay in this browser. Media is fetched only when the user prepares a native share.
const LIBPOST = new Map();
function libPostPanel(m) {
  let state = LIBPOST.get(m.path);
  if (!state) {
    let caption = "";
    try { caption = localStorage.getItem("studio-post-caption:" + m.path) || ""; } catch (_) {}
    state = { caption, file: null, modified: m.modified, request: 0, open: false };
    LIBPOST.set(m.path, state);
  }
  if (state.modified !== m.modified) { state.file = null; state.modified = m.modified; }
  const name = m.path.split("/").pop();
  const canNative = typeof navigator.share === "function" && typeof navigator.canShare === "function" && typeof File === "function";
  const status = el("p", { class: "note lib-post-status", role: "status" },
    canNative ? (state.file ? "Ready to share." : "Prepare the file, then choose a social app from your device's share menu.")
      : "Download the file, open a social site below, and upload it there. Copy the caption if you want to use it.");
  const caption = el("textarea", { rows: "3", placeholder: "Write a caption for this post", "aria-label": "Caption for " + name,
    oninput: e => { state.caption = e.target.value; try { localStorage.setItem("studio-post-caption:" + m.path, state.caption); } catch (_) {} } });
  caption.value = state.caption;
  const copy = el("button", { type: "button", class: "small", onclick: async () => {
    if (!caption.value.trim()) { status.textContent = "Write a caption first."; caption.focus(); return; }
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(caption.value);
      else { caption.select(); if (!document.execCommand("copy")) throw new Error("copy unavailable"); }
      status.textContent = "Caption copied.";
    } catch (_) { caption.focus(); caption.select(); status.textContent = "Select and copy the caption."; }
  } }, "Copy caption");
  const download = el("a", { class: "small", href: file(m.path), download: name }, "Download file");
  const share = el("button", { type: "button", class: "small", disabled: !state.file, onclick: () => {
    if (!state.file) return;
    const data = { files: [state.file] };
    if (caption.value.trim()) data.text = caption.value.trim();
    try {
      if (!navigator.canShare({ files: data.files })) { status.textContent = "This browser cannot share this file. Download it and upload it in your social app."; return; }
      // Call share in the click handler: it requires a fresh user gesture.
      navigator.share(data).then(() => { status.textContent = "Sent to the selected app."; })
        .catch(e => { if (e.name !== "AbortError") status.textContent = e.message || "Could not share this file. Try Download file."; });
    } catch (e) { status.textContent = e.message || "Could not share this file. Try Download file."; }
  } }, "Share file…");
  const prepare = el("button", { type: "button", class: "small", onclick: async () => {
    const request = ++state.request;
    prepare.disabled = true;
    state.file = null;
    share.disabled = true;
    status.textContent = "Preparing " + name + " for sharing…";
    try {
      const response = await fetch(file(m.path));
      if (!response.ok) throw new Error("Could not open the file (" + response.status + ").");
      const blob = await response.blob();
      if (request !== state.request) return;
      const mime = blob.type || ({ ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".mp4": "video/mp4", ".mov": "video/quicktime" }[name.slice(name.lastIndexOf(".")).toLowerCase()] || "application/octet-stream");
      const ready = new File([blob], name, { type: mime });
      if (!navigator.canShare({ files: [ready] })) { status.textContent = "This browser cannot share this file. Download it and upload it in your social app."; return; }
      state.file = ready;
      share.disabled = false;
      status.textContent = "Ready. Choose Share file to pick a social app.";
    } catch (e) { if (request === state.request) status.textContent = e.message || "Could not prepare the file."; }
    finally { if (request === state.request) prepare.disabled = false; }
  } }, "Prepare share");
  const sites = [["WhatsApp", "https://web.whatsapp.com/"], ["X", "https://x.com/"],
    ["Instagram", "https://www.instagram.com/"], ["YouTube", "https://studio.youtube.com/"], ["Facebook", "https://www.facebook.com/"]];
  const siteLinks = el("div", { class: "lib-post-sites" }, el("span", {}, "Open:"),
    sites.map(([label, href]) => el("a", { href, target: "_blank", rel: "noopener noreferrer" }, label)));
  const details = el("details", { class: "lib-post", open: state.open, ontoggle: e => {
    state.open = e.target.open;
    if (!state.open) { ++state.request; state.file = null; share.disabled = true; }
  } },
    el("summary", {}, "Post"),
    el("div", { class: "lib-post-body" }, el("label", {}, "Caption", caption),
      el("div", { class: "lib-post-actions" }, canNative ? prepare : null, canNative ? share : null, copy, download),
      siteLinks, status));
  return details;
}
