#!/usr/bin/env perl

use strict;
use warnings;
use FindBin;
use lib "$FindBin::Bin/../local/lib/perl5";
use lib "$FindBin::Bin/../lib";
use Franckys::CGM;
#use Carp::Always;

Franckys::CGM->to_app;
