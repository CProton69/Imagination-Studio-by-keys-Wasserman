# H3 Image character sheets

The **H3 Image character sheet** app in **Apps → Characters** turns one Library picture into a still reference sheet.
It uses [hideout's H3 Character Sheet Designer](https://github.com/ukr8b3g-cmyk/H3-Character-Sheet-Designer) for
the view layout and prompt, then renders through Studio's MiniMax H3 Image model and job queue. It is separate from
the existing H3 Ref2VA **Turnaround sheet** action and needs no character LoRA.

On a Linux Studio with MiniMax H3 Image installed, install the designer node once:

```bash
bash scripts/setup-h3-sheet.sh
```

The script pins the MIT-licensed node at commit `5865618a3dd6964a53baa91dbb9b8bb447520f20` in the Studio's own
ComfyUI. It downloads no model weights. Restart Studio's ComfyUI after installation so it loads the node.

Open **Apps → Characters → H3 Image character sheet**, choose a Library picture, then choose five views, three
full-body angles, six head angles, or a 13-view sheet. The head preset can instead request six expressions.
The layout guide is on by default. Select a style and sheet size, then queue the job. The finished PNG appears in
the Library and can be used as a first frame or a video reference.

The model estimates side and rear details that the source picture does not show. Check those views before using the
sheet for continuity. The 16 MP option needs substantially more memory and can run slowly.
