#!/usr/bin/env bash
# Install the MIT-licensed H3 Character Sheet Designer node for the Studio's own ComfyUI.
# MiniMax H3 Image weights are installed separately; this script downloads no model files.
set -euo pipefail

PREFIX="${PREFIX:-$HOME/.local/opt/tensorfold-studio}"
COMFY="$PREFIX/ComfyUI"
NODE="$COMFY/custom_nodes/H3-Character-Sheet-Designer"
REPO=https://github.com/ukr8b3g-cmyk/H3-Character-Sheet-Designer.git
REV=5865618a3dd6964a53baa91dbb9b8bb447520f20

[[ -f "$COMFY/main.py" ]] || { echo "Studio ComfyUI is missing at $COMFY" >&2; exit 1; }
if [[ -e "$NODE" && ! -d "$NODE/.git" ]]; then
  echo "The destination exists and is not a Git checkout: $NODE" >&2
  exit 1
fi
if [[ ! -d "$NODE/.git" ]]; then
  [[ "${1:-}" != --verify ]] || { echo "H3 Character Sheet Designer is not installed" >&2; exit 1; }
  git clone "$REPO" "$NODE"
fi
ACTUAL="$(git -C "$NODE" rev-parse HEAD)"
if [[ "$ACTUAL" != "$REV" ]]; then
  [[ "${1:-}" != --verify ]] || { echo "H3 Character Sheet Designer is at $ACTUAL, expected $REV" >&2; exit 1; }
  [[ -z "$(git -C "$NODE" status --porcelain)" ]] || {
    echo "The existing designer checkout has changes; keep them or move it before updating." >&2; exit 1;
  }
  git -C "$NODE" fetch origin "$REV"
  git -C "$NODE" checkout --detach "$REV"
  touch "$PREFIX/workflows.restart"
fi
[[ -f "$NODE/h3_character_sheet/minimax_image_node.py" ]] || {
  echo "MiniMax H3 Image sheet node is missing from $NODE" >&2; exit 1;
}
echo "H3 Character Sheet Designer ready at ${REV:0:8}. Restart Studio ComfyUI before making a sheet."
