#!/bin/sh
set -eu
case "${COTIZA_RUNTIME_USER:-}" in node|app|cotiza) ;; *) echo 'Invalid runtime user' >&2; exit 1;; esac
if [ -L /app/data ]; then echo 'Data directory cannot be a symbolic link' >&2; exit 1; fi
if [ "$(id -u)" = 0 ]; then
  mkdir -p /app/data
  chown -hR "$COTIZA_RUNTIME_USER:$COTIZA_RUNTIME_USER" /app/data
  chmod 700 /app/data
  exec gosu "$COTIZA_RUNTIME_USER" "$@"
fi
if [ ! -w /app/data ]; then echo 'Data directory is not writable by the runtime user' >&2; exit 1; fi
exec "$@"
