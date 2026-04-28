# Dreams

The Dreams surface presents OpenClaw dream output as a focused Dream Diary
timeline.

## What Dreams Shows

Dreams reads the currently exposed OpenClaw Dream Diary snapshot and turns
visible diary timestamps into timeline entries.

The reader is designed for the human-facing diary output, not raw backend event
logs.

## Filtering Behavior

ClawFace filters out non-diary background artifacts so the Dreams view does not
show ordinary chat messages, doctor commands, gateway restart lines, or other
non-diary text as dream entries.

It also keeps OpenClaw dream-writing background sessions out of the main
Sessions list while still showing their diary output in Dreams.

## Limited Chronology

Diary chronology is parsed from visible diary headings and timestamps. If the
diary uses unusual structure, ClawFace may show limited chronology while keeping
the diary text readable.

## Layout

Dreams opens as an auxiliary pane beside chat. On wider layouts, the seam
between Chat and Dreams can be dragged to resize the Dreams pane. The width is
saved in local UI settings.
