#!/bin/sh
# Posix version of the SDD workspace resolver (WSL/Ubuntu bash).
# Usage: sdd-workspace.sh PLAN_FILE
set -eu

if [ $# -ne 1 ]; then
  echo "usage: sdd-workspace.sh PLAN_FILE" >&2
  exit 2
fi

plan=$1
[ -f "$plan" ] || { echo "no such plan file: $plan" >&2; exit 2; }

slug=$(basename "$plan" .md)
root=$(git rev-parse --show-toplevel)
base="$root/.superpowers/sdd"
dir="$base/$slug"
mkdir -p "$dir"
printf '*\n' > "$base/.gitignore"
cd "$dir" && pwd
