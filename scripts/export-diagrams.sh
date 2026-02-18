#!/usr/bin/env bash
set -euo pipefail

out_dir="diagrams/dist"
mkdir -p "$out_dir"

for f in diagrams/*.mmd; do
  base="$(basename "$f" .mmd)"
  npx -y @mermaid-js/mermaid-cli@10.9.0 -i "$f" -o "$out_dir/${base}.svg"
done

echo "Exported Mermaid diagrams to $out_dir"
