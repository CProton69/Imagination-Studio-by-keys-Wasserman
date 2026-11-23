# Break down a reference video

Studio can use [rea-video](https://github.com/JuneYaooo/rea-video) (Apache-2.0) to inspect a clip already in the
Library. It detects shots, cuts, pacing and evidence about how the picture and sound may have been made. This is an
optional CPU analysis job in Studio's one-at-a-time queue; it does not render or remake the video.

Install it once on Mac or Linux, beside the Studio's own Python environment:

```bash
bash scripts/setup-rea-video.sh
```

The script pins rea-video at commit `90eae960d13643e24a0066d6f569df7f390f0567` and installs its dependencies into
`$PREFIX/rea-video-venv` (default `~/.local/opt/tensorfold-studio/rea-video-venv`). It needs `uv`, Python 3.10 or newer,
`ffmpeg` and `ffprobe`. After adding this feature to an already running Studio, let any render finish and restart
Studio so its API loads the new action. Refreshing the page alone loads only the new button. The Studio's rendering
environment keeps its own dependencies, including its existing OpenCV choices.

In **Library**, press **Break down** under a clip. The default analysis is local and does not call a video-capable
cloud model. You can choose **Separate voice, music and effects**; its first run downloads about 216 MB of audio
models into rea-video's cache. The job writes a readable `VIDEO.md` and a ZIP containing the full HTML report and
shot assets under `~/ImaginationStudio/analysis`. Both appear with the finished job and move to the Studio's trash
when the job is deleted.

In **Library → Video breakdowns**, **Open report** reads the saved report package in the page. Its sections include
the timeline, sound, cast, shot notes, and **Remake it yourself**. **Send draft to Create** appears above the report
sections. For an AI generation unit it transfers its reported action, measured lighting and grade into a fresh
MiniMax H3 text-to-video setup; **Include observed framing** is optional on each unit. It clears any previous LoRA, motion reference,
first frame, and dialogue. Write missing action and spoken lines in Create, check the speaker of each line, then
review the final prompt before queuing. It never renders automatically.

The report contains evidence and uncertainty, especially when judging filmed footage against AI or 3D without a
vision model. A report whose remake route is a still with a pan and zoom has no AI generation unit. Its top button
starts an H3 adaptation with the observed whole-frame pan and zoom, leaving the scene and action to write. A report
made without image reading may have an AI unit but no shot description; its action field will be empty in Create.
Read the source frames and write the actual scene before rendering. This Studio action has not been checked on native
Windows and is unavailable there.
