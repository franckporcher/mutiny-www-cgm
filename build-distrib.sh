#!/bin/bash
#
# build-distrib.sh -- Fabrique la dsitribution Perl local::lib=local avec # Carton
#
# PROJECT: MUTINY Tahiti's websites
#
# Copyright (C) 2014-2015 - Franck Porcher, Ph.D 
# www.franckys.com
# Tous droits réservés. All rights reserved

cd "$(dirname "$0")"
carton install
carton bundle
tar cvzf carton.deploy.tgz cpanfile cpanfile.snapshot vendor
