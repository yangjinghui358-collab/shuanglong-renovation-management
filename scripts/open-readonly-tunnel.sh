#!/usr/bin/env bash
set -euo pipefail

if (( $# != 0 )); then
  printf 'Usage: set SSH_HOST, SSH_USER and optionally LOCAL_DB_PORT; pass no arguments.\n' >&2
  exit 64
fi

: "${SSH_HOST:?Set SSH_HOST in your shell or SSH config; never put it in Git}"
: "${SSH_USER:?Set SSH_USER to the restricted tunnel account in your shell}"
: "${LOCAL_DB_PORT:=15432}"

if [[ ! "${SSH_HOST}" =~ ^[A-Za-z0-9._-]+$ ]]; then
  printf 'SSH_HOST must be a host name, address, or SSH config alias without whitespace or options.\n' >&2
  exit 64
fi

if [[ ! "${SSH_USER}" =~ ^[A-Za-z_][A-Za-z0-9._-]*$ ]]; then
  printf 'SSH_USER contains unsupported characters.\n' >&2
  exit 64
fi

if [[ ! "${LOCAL_DB_PORT}" =~ ^[0-9]+$ ]] ||
  (( LOCAL_DB_PORT < 1024 || LOCAL_DB_PORT > 65535 )); then
  printf 'LOCAL_DB_PORT must be an integer from 1024 through 65535.\n' >&2
  exit 64
fi

exec ssh -N -T \
  -o BatchMode=yes \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -L "127.0.0.1:${LOCAL_DB_PORT}:127.0.0.1:5432" \
  -- \
  "${SSH_USER}@${SSH_HOST}"
