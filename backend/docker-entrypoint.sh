#!/bin/sh
set -e

DISPLAY_NUM="${DISPLAY#:}"

# docker restart 保留容器文件系统，上次运行残留的 lock 会让 Xvfb 拒绝启动
rm -f "/tmp/.X${DISPLAY_NUM}-lock" "/tmp/.X11-unix/X${DISPLAY_NUM}"

Xvfb "$DISPLAY" -screen 0 1280x800x24 -nolisten tcp &

# 等就绪再放行：否则 Xvfb 挂掉后应用照常启动，直到首次launch浏览器才报
# "Missing X server"，排查成本高
i=0
until [ -S "/tmp/.X11-unix/X${DISPLAY_NUM}" ]; do
  i=$((i + 1))
  if [ "$i" -gt 100 ]; then
    echo "entrypoint: Xvfb failed to start on $DISPLAY" >&2
    exit 1
  fi
  sleep 0.1
done

exec "$@"
