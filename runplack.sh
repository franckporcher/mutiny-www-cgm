#!/bin/bash
#
# runplack.sh -- Lancement du serveur web Dancer/plack local pour servir CGM et MuffinMC
# /!\ Ne pas utiliser en déploiement.
# Uniquement pour tester directement sur l'URL http://127.0.0.1:5000/cgm
#
# PROJECT: MUTINY Tahiti's websites
#
# Copyright (C) 2014-2015 - Franck Porcher, Ph.D 
# www.franckys.com
# Tous droits réservés
plenv exec carton exec plackup -r -R ./Franckys,./public,./views bin/app.psgi
