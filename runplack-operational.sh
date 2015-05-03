#!/bin/bash

cd "$(dirname "$0")"

PLACK_MODULE_DIR="$(pwd)"
PLENV_ROOT="${PLACK_MODULE_DIR}/env/plenv"
PLACK_HOST='127.0.0.1'
PLACK_PORT='8080'
PLACK_APP='bin/app.psgi'

export PLACk_MODULE_DIR PLENV_ROOT PLACK_HOST PLACK_PORT PLACK_APP

env                             \
    PLENV_ROOT="$PLENV_ROOT"    \
    PERL5LIB="${PLACK_MODULE_DIR}/local/lib/perl5:${PLACK_MODULE_DIR}/lib" \
    PLENV_SHELL=bash            \
    PLENV_ROOT="${PLENV_ROOT}"  \
    BASH=/bin/bash              \
    SHELL=/bin/bash             \
    PATH="${PLENV_ROOT}/bin:${PLENV_ROOT}/shims:/opt/local/bin:/opt/local/sbin:/usr/local/mysql/bin:/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin:/opt/X11/bin" \
    plenv exec carton exec  plackup         \
        --host "${PLACK_HOST}"              \
        -p      "${PLACK_PORT}"             \
        -r -R ./Franckys,./public,./views   \
        --daemonize                         \
            "${PLACK_APP}"

