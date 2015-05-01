#!/usr/bin/env perl 
#===============================================================================
#
#         FILE: env.pl
#
#        USAGE: ./env.pl  
#
#  DESCRIPTION: 
#
#      OPTIONS: <+OPTIONS+>
# REQUIREMENTS: <+REQUIREMENTS+>
#         BUGS: <+BUGS+>
#        NOTES: <+NOTES+>
#       AUTHOR: Dr. Franck Porcher, Ph.D. (fpo), franck.porcher@franckys.com
# ORGANIZATION: Franckys
#      VERSION: 1.0
#      CREATED: 14.03.2015 20:00:48
#     REVISION: <+REVISION+>
#===============================================================================

use strict;
use warnings;
use utf8;
use feature qw( say );

while ( my($var, $value) = each %ENV ) {
    say "$var\t$value";
}

