#!/bin/bash
#
# update-distrib.sh -- Resynchronize la distribution Perl local::lib=local avec Carton
#
# PROJECT: MUTINY Tahiti's websites
#
# Copyright (C) 2014-2015 - Franck Porcher, Ph.D 
# www.franckys.com
# Tous droits réservés. All rights reserved


cd "$(dirname "$0")"

##
# LOAD ENV
#
CONF="env/dot.bashrc"
if [ -e "${CONF}" ]
then
    source "${CONF}"
fi

tar xvf carton.deploy.tgz
carton install --cached --deployment --path=./local 2>&1  | tee carton.deploy.log
