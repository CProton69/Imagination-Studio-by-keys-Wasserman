"use strict";
/* Optional, local rea-video analysis of a clip already in the Studio Library. */
const REA = { status: null, loading: false, open: null, audio: false, job: null, report: null, reportJob: null };
async function reaOpenReport(j) {
  try { REA.report = await api("/api/rea-video/reports/" + encodeURIComponent(j.id)); REA.reportJob = j.id; render();
    setTimeout(() => document.querySelector("#reareport")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  } catch (e) { toast(e.message); }
}
function reaSend(unit, camera = false) {
  const brief = (unit.brief || []).filter(b => b && typeof b === "object");
  const action = brief.map(b => [b.source, b.action].filter(Boolean).join(". ")).filter(Boolean).join("\n");
  const source = REA.report?.source || {}, firstShot = REA.report?.shots?.[0] || {};
  const framing = brief.map(b => b.framing).filter(Boolean).join("; ") ||
    ((REA.report?.strategy || "").includes("still-image move") ? "A whole-frame pan and zoom." : "");
  const lighting = firstShot.aspects?.lighting?.result || {}, grade = firstShot.aspects?.grade?.result || {};
  const look = [lighting.quality, lighting.color_temp, grade.look, grade.tone].filter(Boolean).join("; ");
  const duration = Number(unit.duration) || Number(source.duration) || 5;
  Object.assign(C, { goes: "video", start: "text", engine: "h3", h3quality: "standard", res: "480p", up: false,
    scene: look, action,
    camera: camera ? framing : "", dialogue: [], soundscape: "", music: "N/A", prompt: "", parts: null,
    image: null, lastImage: null, refs: [], subjects: [], refVideos: [], video_subjects: [], refAudios: [], audio_notes: [],
    video_sound: false, motion: null, loras: [], refmods: [], textEncoder: "", transformer: "", steps: "",
    beats: "", retake: false, job: null, step: 0,
    seconds: typeof fitLength === "function" ? fitLength(Math.min(15, duration)) : 5, frames: null });
  sync(); go("Create");
  toast(action ? "Remake draft is in Create. Review the action, speakers and camera before rendering."
    : "The report did not describe the action. Write what happens in Create before rendering.");
}
function reaReportPanel() {
  const r = REA.report;
  if (!r) return null;
  const names = { "VIDEO.md": "Overview", "report.md": "Full report text", "video/timeline.md": "Timeline",
    "video/content.md": "Content", "video/moments.md": "Moments", "video/look.md": "Camera and look",
    "video/rhythm.md": "Rhythm", "video/cast.md": "Cast and props", "video/sound.md": "Sound",
    "video/packaging.md": "Packaging", "video/remake.md": "Remake it yourself" };
  return el("section", { class: "card", id: "reareport", style: "margin:12px 0" },
    el("div", { class: "row" }, el("h3", { class: "fit" }, "Video breakdown report"),
      el("button", { class: "small", onclick: () => { REA.report = null; REA.reportJob = null; render(); } }, "Close")),
    el("p", { class: "note" }, (r.source && (r.source.filename || r.source.file) || "Video") + " · " + (r.strategy || "breakdown")),
    el("p", { class: "note" }, "The report is an analysis, not a recreation. Its observations and AI/filmed classifications are uncertain when image reading was unavailable. Review the shot frames in the full report before using them. Source frames in the report are not attached to Create; upload one there if needed."),
    el("div", { class: "row", style: "margin:10px 0" },
      el("button", { class: "hot", onclick: () => reaSend((r.units || [])[0] || { duration: r.source?.duration, brief: [] }, !(r.units || []).length) }, "Send draft to Create"),
      el("span", { class: "note fit" }, (r.units || []).length
        ? "Starts with the first AI generation unit. Check its action and speaker before rendering."
        : "This report has no AI generation unit. This starts an H3 draft with its measured pan and zoom; write the scene and action yourself.")),
    (r.units || []).length ? el("div", { class: "seg" }, el("h4", {}, "Generation units"),
      r.units.map(u => el("div", { class: "row", style: "margin:8px 0" },
        el("span", { class: "fit" }, (u.id || "Unit") + " · " + (u.duration || "?") + " s · shots " + (u.shots || []).join(", ") +
          ((u.prompt_missing || []).length ? " · shot description missing" : "") +
          ((u.brief || []).some(b => /close-up/i.test(b.framing || "")) ? " · observed framing: close-up" : "")),
        el("button", { class: "small", onclick: () => reaSend(u) }, "Send draft to Create"),
        el("button", { class: "small", onclick: () => reaSend(u, true) }, "Include observed framing"))))
      : el("p", { class: "note" }, "This report recommends a local still-image move rather than an AI video generation unit. Its Remake section explains that route."),
    Object.entries(r.parts || {}).map(([path, value]) =>
      el("details", { style: "margin:8px 0" },
        el("summary", {}, names[path] || path.replace("video/shots/", "Shot ").replace(/\.md$/, "")),
        el("pre", { style: "white-space:pre-wrap;overflow-wrap:anywhere;max-height:420px;overflow:auto" }, value))));
}
async function reaLoad() {
  if (REA.status || REA.loading) return;
  REA.loading = true;
  try { REA.status = await api("/api/rea-video"); }
  catch (e) { REA.status = { ready: false, why: e.message === "Not Found"
    ? "Studio's running server has not loaded video breakdowns yet. Let the current render finish, then restart Studio and check again."
    : e.message }; }
  REA.loading = false;
  if (tab === "Library") render();
}
function reaButtons(m) {
  if (m.kind !== "video") return [];
  return [el("button", { class: "small", title: "Find shots, cuts, pacing and how this clip may have been made",
    onclick: () => { REA.open = m.path; REA.audio = false; REA.job = null; render();
      setTimeout(() => document.querySelector("#reapanel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60); } }, "Break down")];
}
function reaPanel() {
  if (!REA.open) return null;
  const state = REA.status || { ready: false, why: "Checking the optional analyzer…" };
  const recent = REA.job ? jobs.find(j => j.id === REA.job) :
    [...jobs].reverse().find(j => j.kind === "rea_video" && (j.params?.video || "").endsWith("/" + REA.open));
  const source = REA.open;
  return el("section", { class: "card", id: "reapanel", style: "margin:12px 0" },
    el("div", { class: "row" }, el("h3", { class: "fit" }, "Break down a video"),
      el("button", { class: "small", onclick: () => { REA.open = null; render(); } }, "Close")),
    el("p", { class: "note" }, source),
    el("p", { class: "note" }, "rea-video finds shot boundaries, visual evidence, pacing and a remake outline. It runs locally through Studio's queue and writes VIDEO.md plus a report package. It does not render a new clip or send this video to a vision service."),
    !state.ready ? el("div", { class: "row", style: "align-items:center" },
      el("p", { class: "note fit", style: "color:var(--warn)" }, state.why),
      el("button", { class: "small", onclick: () => { REA.status = null; reaLoad(); } }, "Check again")) : null,
    el("label", { style: "display:flex;gap:6px;align-items:center" },
      bind(REA, "audio", el("input", { type: "checkbox", style: "width:auto" })),
      "Separate voice, music and effects (first run downloads about 216 MB of models)"),
    el("button", { class: "hot", disabled: !state.ready, onclick: async () => { try {
      const job = await api("/api/jobs", { kind: "rea_video", title: "Break down " + source.split("/").pop(), params: { video: source, audio: REA.audio } });
      REA.job = job.id; await poll(); render();
    } catch (e) { toast(e.message); } } }, "Queue breakdown"),
    recent ? el("div", { style: "margin-top:12px" }, jobCard(recent),
      recent.status === "done" ? el("div", { class: "row", style: "margin-top:8px" },
        el("button", { class: "fit small", onclick: () => reaOpenReport(recent) }, "Open report"),
        el("a", { class: "fit", href: file(recent.outputs[0]), target: "_blank", rel: "noopener" }, "Read VIDEO.md"),
        el("a", { class: "fit", href: file(recent.outputs[1]), download: "rea-video-report.zip" }, "Download full report")) : null) : null);
}

function reaLibrary() {
  const reports = [...jobs].filter(j => j.kind === "rea_video" && j.status === "done" && j.outputs?.length === 2).reverse();
  if (!reports.length) return null;
  return el("section", { class: "card", style: "margin:12px 0" }, el("h3", {}, "Video breakdowns"),
    reports.map(j => el("div", { class: "row", style: "margin:6px 0" },
      el("span", { class: "fit" }, j.title),
      el("button", { class: "small", onclick: () => reaOpenReport(j) }, "Open report"),
      el("a", { class: "small", href: file(j.outputs[0]), target: "_blank", rel: "noopener" }, "VIDEO.md"),
      el("a", { class: "small", href: file(j.outputs[1]), download: "rea-video-report.zip" }, "Full report"))), reaReportPanel());
}
