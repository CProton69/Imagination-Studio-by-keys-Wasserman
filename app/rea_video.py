"""Optional, local rea-video breakdowns through the Studio job queue."""

from __future__ import annotations

import os
import shutil
import json
import zipfile
from pathlib import Path

from fastapi import HTTPException

EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm"}
REPORT_PARTS = ("VIDEO.md", "report.md", "video/timeline.md", "video/content.md",
                "video/moments.md", "video/look.md", "video/rhythm.md", "video/cast.md",
                "video/sound.md", "video/packaging.md", "video/remake.md")


def report(archive: Path) -> dict:
    """Read the small, useful text from a completed Studio breakdown package."""
    try:
        if not archive.is_file() or archive.stat().st_size > 200 * 1024**2:
            raise ValueError("report package is missing or too large")
        with zipfile.ZipFile(archive) as package:
            names = set(package.namelist())
            if "breakdown.json" not in names or "VIDEO.md" not in names:
                raise ValueError("report package has no VIDEO.md or breakdown.json")
            def read(name: str, limit: int = 2 * 1024**2) -> str:
                info = package.getinfo(name)
                if info.file_size > limit:
                    raise ValueError(name + " is too large")
                return package.read(name).decode("utf-8")
            data = json.loads(read("breakdown.json"))
            text_names = [name for name in REPORT_PARTS if name in names]
            text_names += sorted(name for name in names if name.startswith("video/shots/") and name.endswith(".md"))[:40]
            if sum(package.getinfo(name).file_size for name in text_names) > 4 * 1024**2:
                raise ValueError("report text is too large")
            parts = {name: read(name) for name in text_names}
        if not isinstance(data, dict) or not isinstance(data.get("shots"), list):
            raise ValueError("breakdown.json has no shot list")
        plan = data.get("production_plan") or {}
        return {"source": data.get("source") or {}, "summary": data.get("summary") or {},
                "shots": [{"index": s.get("index"), "start": s.get("start"), "end": s.get("end"),
                           "aspects": s.get("aspects") or {}, "vlm": s.get("vlm")}
                          for s in data["shots"] if isinstance(s, dict)],
                "units": plan.get("units") or [], "strategy": plan.get("summary") or "",
                "parts": parts}
    except (OSError, UnicodeError, zipfile.BadZipFile, KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise HTTPException(400, f"cannot read this breakdown: {error}") from error


def executable() -> Path:
    prefix = Path(os.environ.get("PREFIX") or Path.home() / ".local/opt/tensorfold-studio")
    return prefix / "rea-video-venv" / "bin" / "rea-video"


def status() -> dict:
    if os.name == "nt":
        return {"ready": False, "why": "The Studio's rea-video job is available on Mac and Linux; its Windows runtime has not been checked."}
    if not executable().is_file() or not os.access(executable(), os.X_OK) or not (executable().parent / "python").is_file():
        return {"ready": False, "why": "Install the optional analyzer with bash scripts/setup-rea-video.sh, then refresh Studio."}
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        return {"ready": False, "why": "rea-video needs ffmpeg and ffprobe on this machine."}
    return {"ready": True, "why": "", "source": "https://github.com/JuneYaooo/rea-video"}


def parameters(params: dict, inside) -> dict:
    if not isinstance(params, dict) or not isinstance(params.get("video"), str):
        raise HTTPException(400, "choose a video from this Studio's Library")
    path = inside(params["video"])
    if path.suffix.lower() not in EXTENSIONS or not path.is_file():
        raise HTTPException(400, "choose an existing mp4, mov, mkv or webm in this Studio")
    if path.stat().st_size > 2 * 1024**3:
        raise HTTPException(400, "the first breakdown route takes a video up to 2 GB")
    audio = params.get("audio", False)
    if not isinstance(audio, bool):
        raise HTTPException(400, "audio is true or false")
    return {"video": str(path), "audio": audio}


def build(params: dict, home: Path, job_id: str, inside) -> tuple[list[str], dict, list[str]]:
    state = status()
    if not state["ready"]:
        raise HTTPException(501, state["why"])
    chosen = parameters(params, inside)
    target = home / "analysis" / job_id
    output = [str(target.with_suffix(".md")), str(target.with_suffix(".zip"))]
    script = Path(__file__).resolve().parent.parent / "scripts" / "rea-video-job.py"
    command = [str(executable().parent / "python"), str(script), "--binary", str(executable()),
               "--video", chosen["video"], "--target", str(target)]
    if chosen["audio"]:
        command.append("--audio")
    return command, {}, output
