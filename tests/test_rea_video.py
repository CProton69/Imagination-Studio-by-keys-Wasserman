"""The optional analyzer stays in the queue and produces a portable report package."""

import os
import json
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

import pytest
from fastapi import HTTPException

ROOT = Path(__file__).resolve().parent.parent
os.environ.setdefault("STUDIO_HOME", str(Path(tempfile.mkdtemp()) / "Studio"))
sys.path.insert(0, str(ROOT / "app"))
import rea_video  # noqa: E402
import server  # noqa: E402


def test_build_requires_local_media_and_uses_an_isolated_cli(tmp_path, monkeypatch):
    source = tmp_path / "clip with spaces.mp4"
    source.write_bytes(b"video")
    tool = tmp_path / "rea-video-venv/bin/rea-video"
    tool.parent.mkdir(parents=True)
    tool.write_text("")
    monkeypatch.setattr(rea_video, "status", lambda: {"ready": True, "why": ""})
    monkeypatch.setattr(rea_video, "executable", lambda: tool)
    command, env, outputs = rea_video.build({"video": str(source), "audio": True}, tmp_path, "job1", Path)
    assert command[0] == str(tool.parent / "python") and command[-1] == "--audio"
    assert command[command.index("--video") + 1] == str(source)
    assert env == {} and outputs == [str(tmp_path / "analysis/job1.md"), str(tmp_path / "analysis/job1.zip")]
    with pytest.raises(HTTPException, match="mp4, mov, mkv or webm"):
        rea_video.parameters({"video": str(tmp_path / "missing.mp4")}, Path)
    with pytest.raises(HTTPException, match="true or false"):
        rea_video.parameters({"video": str(source), "audio": "yes"}, Path)


def test_wrapper_keeps_the_report_and_shot_assets(tmp_path):
    source = tmp_path / "input.mp4"
    source.write_bytes(b"video")
    binary = tmp_path / "fake-rea-video"
    binary.write_text("#!/usr/bin/env python3\nimport pathlib, sys\n"
                      "assert '--no-vlm' in sys.argv and '--no-stems' in sys.argv and '--workers' in sys.argv\n"
                      "out = pathlib.Path(sys.argv[sys.argv.index('-o') + 1])\n"
                      "(out / 'shots').mkdir(parents=True)\n"
                      "(out / 'VIDEO.md').write_text('# Shot map\\n')\n"
                      "(out / 'report.html').write_text('<h1>Report</h1>')\n"
                      "(out / 'shots' / 'first.jpg').write_bytes(b'frame')\n")
    binary.chmod(0o755)
    target = tmp_path / "analysis" / "job1"
    subprocess.run([sys.executable, str(ROOT / "scripts/rea-video-job.py"), "--binary", str(binary),
                    "--video", str(source), "--target", str(target)], check=True, timeout=10, capture_output=True)
    assert target.with_suffix(".md").read_text() == "# Shot map\n"
    with zipfile.ZipFile(target.with_suffix(".zip")) as archive:
        assert set(archive.namelist()) == {"VIDEO.md", "report.html", "shots/first.jpg"}


def test_api_job_uses_studio_queue_and_refuses_outside_files(tmp_path, monkeypatch):
    home = tmp_path / "Studio"
    source = home / "uploads" / "clip.mp4"
    source.parent.mkdir(parents=True)
    source.write_bytes(b"video")
    monkeypatch.setattr(server, "HOME", home)
    monkeypatch.setattr(rea_video, "status", lambda: {"ready": True, "why": ""})
    monkeypatch.setattr(rea_video, "executable", lambda: tmp_path / "venv/bin/rea-video")
    captured = []
    monkeypatch.setattr(server, "enqueue", lambda kind, title, params: captured.append((kind, title, params)) or {"id": "j1"})
    reply = server.queue_job({"kind": "rea_video", "params": {"video": "uploads/clip.mp4"}})
    assert reply == {"id": "j1"} and captured[0][0] == "rea_video"
    assert captured[0][2]["video"] == str(source) and captured[0][2]["audio"] is False
    outside = tmp_path / "outside.mp4"
    outside.write_bytes(b"video")
    with pytest.raises(HTTPException) as exc:
        server.queue_job({"kind": "rea_video", "params": {"video": str(outside)}})
    assert "outside the studio folder" in exc.value.detail


def test_report_reads_generation_units_and_text_only_from_a_completed_job(tmp_path, monkeypatch):
    home = tmp_path / "Studio"
    folder = home / "analysis"
    folder.mkdir(parents=True)
    archive = folder / "job1.zip"
    with zipfile.ZipFile(archive, "w") as package:
        package.writestr("VIDEO.md", "# Overview")
        package.writestr("video/remake.md", "# Remake")
        package.writestr("breakdown.json", json.dumps({"source": {"file": "source.mp4", "duration": 5},
            "summary": {"confidence": 0.5}, "shots": [{"index": 1, "start": 0, "end": 5,
            "aspects": {"camera": {"result": {"move": "pan"}}}}],
            "production_plan": {"units": [{"id": "G1", "duration": 5, "brief": [{"action": "walks"}]}]}}))
        package.writestr("shots/shot_001.jpg", b"image data")
    monkeypatch.setattr(server, "HOME", home)
    monkeypatch.setitem(server.jobs, "job1", {"kind": "rea_video", "status": "done",
                                              "outputs": ["analysis/job1.md", "analysis/job1.zip"]})
    report = server.rea_video_report("job1")
    assert report["units"][0]["brief"][0]["action"] == "walks"
    assert report["parts"]["video/remake.md"] == "# Remake"
    assert "shots/shot_001.jpg" not in report["parts"]
    with pytest.raises(HTTPException):
        server.rea_video_report("not-a-job")


def test_report_handoff_clears_old_motion_and_lora_and_keeps_missing_action_visible():
    if not shutil.which("node"):
        pytest.skip("node is needed for the page handoff")
    script = r"""
const fs = require('fs'), vm = require('vm');
globalThis.C = { loras: [{id:'combat'}], motion: {layer:'reference'}, scene:'old', action:'old' };
globalThis.S = { durations: {5:124, 10:243, 15:362}, long:{} };
globalThis.sync = () => {}; globalThis.go = t => { globalThis.sent = t; };
globalThis.toast = t => { globalThis.notice = t; };
globalThis.fitLength = n => n <= 5 ? 5 : n <= 10 ? 10 : 15;
globalThis.el = (tag, attrs, ...kids) => ({tag, attrs, kids: kids.flat(Infinity)});
vm.runInThisContext(fs.readFileSync(process.argv[1], 'utf8'));
REA.report = { source: {duration:5}, shots: [{aspects: {lighting: {result: {quality:'soft light'}}, grade: {result: {tone:'cool'}}}}] };
reaSend({duration:5, brief:[{action:'', framing:'close-up, camera pans'}]}, false);
if (C.action !== '' || C.camera !== '' || C.scene !== 'soft light; cool' || C.loras.length || C.motion || C.engine !== 'h3' || sent !== 'Create' || !notice.includes('did not describe')) process.exit(1);
REA.report = { strategy:'still-image move / static frame', source:{duration:15}, shots:[], units:[], parts:{'VIDEO.md':'overview'} };
const panel = reaReportPanel();
const walk = n => typeof n === 'string' ? n : n && n.kids ? n.kids.map(walk).join(' ') : '';
if (!walk(panel).includes('Send draft to Create')) process.exit(2);
reaSend({duration:15, brief:[]}, true);
if (C.camera !== 'A whole-frame pan and zoom.' || C.seconds !== 15 || C.action !== '') process.exit(3);
"""
    done = subprocess.run(["node", "-e", script, str(ROOT / "app/static/rea-video.js")],
                          text=True, capture_output=True, timeout=10)
    assert done.returncode == 0, done.stderr
