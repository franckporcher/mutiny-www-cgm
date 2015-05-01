#!/usr/bin/env perl

use strict;
use warnings;
use FindBin;
use lib "$FindBin::Bin/../local/lib/perl5";
use lib "$FindBin::Bin/../lib";

use Carp::Always;

use Franckys::CGM;
Franckys::CGM->to_app;
