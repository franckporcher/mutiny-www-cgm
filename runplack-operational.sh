#!/bin/bash
#
# runplack-operational.sh -- Lancement du serveur web Dancer/plack local
# (proxied par Apache) pour servir CGM et MuffinMC
#
# PROJECT: MUTINY Tahiti's websites
#
# Copyright (C) 2014-2015 - Franck Porcher, Ph.D 
# www.franckys.com
# Tous droits réservés
# All rights reserved

cd "$(dirname "$0")"

##
# LOAD ENV
#
CONF="$(basename "$0").conf"
if [ -e "${CONF}" ]
then
    source "${CONF}"
fi
PLACK_HOST="${PLACK_HOST:-127.0.0.1}"
PLACK_PORT="${PLACK_PORT:-8080}"

source env/dot.bashrc

PLACK_MODULE_DIR="$(pwd)"
PLENV_ROOT="${PLACK_MODULE_DIR}/env/plenv"
PLACK_APP='bin/app.psgi'

export PLACK_HOST PLACK_PORT PLACk_MODULE_DIR PLENV_ROOT PLACK_APP

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

