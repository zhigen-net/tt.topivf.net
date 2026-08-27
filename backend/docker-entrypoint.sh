#!/bin/sh
set -e

Xvfb "$DISPLAY" -screen 0 1280x800x24 -nolisten tcp &

exec "$@"
