#!/bin/sh
# Posix version of the SDD task-brief extractor (WSL/Ubuntu bash).
# Usage: task-brief.sh PLAN_FILE TASK_NUMBER [OUTFILE]
set -eu

if [ $# -lt 2 ] || [ $# -gt 3 ]; then
  echo "usage: task-brief.sh PLAN_FILE TASK_NUMBER [OUTFILE]" >&2
  exit 2
fi

plan=$1
n=$2
[ -f "$plan" ] || { echo "no such plan file: $plan" >&2; exit 2; }

if [ $# -eq 3 ]; then
  out=$3
else
  dir=$(sh "$(cd "$(dirname "$0")" && pwd)/sdd-workspace.sh" "$plan")
  out="$dir/task-${n}-brief.md"
fi

awk -v n="$n" '
  /^```/ { infence = !infence }
  !infence && /^#+[ \t]+Task[ \t]+[0-9]+/ {
    intask = ($0 ~ ("^#+[ \t]+Task[ \t]+" n "([^0-9]|$)"))
  }
  intask { print }
' "$plan" > "$out"

if [ ! -s "$out" ]; then
  echo "task ${n} not found in ${plan}" >&2
  exit 3
fi

echo "wrote ${out}: $(wc -l < "$out" | tr -d ' ') lines"
