#!/usr/bin/env perl 
#===============================================================================
#
#         FILE: cgm.pl
#
#        USAGE: cgm.pl OPTIONS
#
#  DESCRIPTION: Main entry into MUTINY Tahiti's project CGM module
#
#      OPTIONS: <+OPTIONS+>
# REQUIREMENTS: <+REQUIREMENTS+>
#         BUGS: <+BUGS+>
#        NOTES: <+NOTES+>
#       AUTHOR: Franck Porcher, Ph.D. - franck.porcher@franckys.com
# ORGANIZATION: Franckys
#      VERSION: v0.11
#      CREATED: Mer 18 fév 2015 18:07:33 PST
#     REVISION: <+REVISION+>
#
# Copyright (C) 2014-2015 - Franck Porcher, Ph.D 
# www.franckys.com
# Tous droits réservés - All rights reserved
#===============================================================================
package main;
use version; our $VERSION = 'v0.11';                # Keep on same line
use v5.20;                                          ## no critic (ValuesAndExpressions::ProhibitVersionStrings)
use strict;
use warnings;
use autodie;
use feature             qw( switch say unicode_strings );
use FindBin;
use lib "$FindBin::Bin/../local/lib/perl5";
use lib "$FindBin::Bin/../lib";
use Carp                qw( carp croak confess cluck );
use Const::Fast;
use Pod::Usage;
use File::Basename      qw( basename );
use Getopt::Long;
Getopt::Long::Configure('bundling');                # Allow bundling of 1-char option "A la Unix"
    $0 = basename($0);                              # shorter messages
use Try::Tiny;                                      # try {...} catch { carp "got a die: $_} finally { always_done_and_suppresses_errors }
# use File::Copy
# use Scalar::Util;
# use Regexp::Common;
# use Path::Class
#use Carp::Always;
use Franckys::Trace;
use Franckys::Error;
use Franckys::CGM::Parser;


#----------------------------------------------------------------------------
# UTF8 STUFF
#----------------------------------------------------------------------------
use utf8;
use warnings            FATAL => "utf8";
use charnames           qw( :full :short );
use Encode              qw( encode decode );
use Unicode::Collate;
use Unicode::Normalize  qw( NFD NFC );
    #$_=NFD(chomp(readline()));  say NFC($_);


#----------------------------------------------------------------------------
# I/O
#----------------------------------------------------------------------------
use open qw( :encoding(UTF-8) :std );
binmode(DATA, ":utf8 :encoding(UTF-8)");
STDOUT->autoflush(1);   # our $| = 1;
END { close STDOUT }

# Decode UTF-8 input args (make sure the terminal encoding is set to UTF-8)
if (grep /\P{ASCII}/ => @ARGV) { 
       @ARGV = map { decode("UTF-8", $_) } @ARGV;
}


#----------------------------------------------------------------------------
# EXCEPTION HANDLING
#----------------------------------------------------------------------------
#use sigtrap;           # qw(die untrapped normal-signals error-signals);
use sigtrap handler => \&ipc_catch, qw(untrapped normal-signals error-signals);
local $SIG{__WARN__} = \&ipc_catch;

my $is_interruptible = 1;   # For interruption processing
my @pending_signals  = ();  # Fifo of unhandled pending signals
my @handled_signals  = ();  # List of signals handled
my $ipc_cc;                 # IPC signal handler user continuation

ipc_set_cc();

sub ipc_catch {
    my $sig = shift;
    push @pending_signals, $sig;
    trace("SIGNAL '$sig' received at " . scalar(localtime));
    ipc_handler() if $is_interruptible;
}

sub ipc_handler {
   while (my $sig = shift @pending_signals) {
        push @handled_signals, $sig;

        # Perl already in a try block (where signals will be trapped)
        # die "Signal: $sig" if $^S; 
        given ($_) {
            # when TERM { }
            # when TERM { }
            default {
                $ipc_cc->($sig);
            }
        }
    }
}

sub ipc_set_cc {
    $ipc_cc  = shift || \&ipc_default_cc;
}

sub ipc_default_cc {
    my $sig = shift;
    ipc_die( "Signal: $sig" );
}

sub ipc_die {
    my $msg = shift;
    confess $msg;
}


#----------------------------------------------------------------------------
# OPTIONS HANDLING -- option recipients & handlers go here
#----------------------------------------------------------------------------
my %option = (
    # REMINDER ;-)
    #   flag    => '',
    #   num     => undef,
    #   str     => '',
    #   incr    => 0,
    #   n_str   => [],
    #   rgb     => [],
    #   define  => {},
    file        => '',
    kintpv      => '',
    dump        => 0,
);

GetOptions(
    'h|help'        => sub { pod2usage(-exitval => 0, -verbose => 1) },
    'V|version'     => sub { print "$0 $VERSION\n"; exit 0; },
    't|trace!'      => sub { 
        my ($opt_name, $opt_value) = @_;
        if ($opt_value) {
            trace_on();
        }
        else {
            trace_off();
        }
    },
    'd|dump!'       => \$option{dump},
    'f|file=s'      => \$option{file},
    'k|kintpv=s'    => \$option{kintpv},
    #
    # REMINDER ;-)
    #
    #   'flag'          => $opt{ flag   },      # --flag (boolean)
    #   'flag!'         => $opt{ flag   },      # --flag | --noflag                 (boolean)
    #   'inum=i'        => $opt{ inum   },      # --inum=2                          (integral)
    #   'fnum=f'        => $opt{ fnum   },      # --fnum=3.14                       (float)
    #   'str=s'         => $opt{ str    },      # --str hello                       (string)
    #   'incr+'         => $opt{ incr   },      # --incr --incr ...                 (integral)
    #   'n_str=s@'      =>  { n_str  },         # --n_str hello --n_str world ...   (string)
    #   'n_str=s{2}'    =>  { n_str  },         # --n_str hello world ...           (string)
    #   'rgb=i@'        =>  { rgb    },         # --rgb 100 --rgb 100 --rgb 255     (integral+)
    #   'rgb=i{3}'      =>  { rgb    },         # --rgb 100 100 255                 (integral x 3)
    #   'define=s%'     =>  { define },         # --define key=value ...            (hash)
) or pod2usage(1);

#----------------------------------------------------------------------------
# PROGRAM GLOBAL OBJECTS AND CONSTANTS
#----------------------------------------------------------------------------
# CONSTANTS


# GLOBALS

#----------------------------------------------------------------------------
# MAIN
#----------------------------------------------------------------------------
main( @ARGV );
sub main {
    try {
        if ($option{file}) {
            my $parser = Franckys::CGM::Parser->new( $option{file} );
            Franckys::Error::die_if_error($parser);
            $parser->parse_file();

            # Generation
            if ( $option{kintpv} ) {
                my ($cr, $msg) = $parser->to_kintpv( $option{kintpv} );

                if ($cr) {
                    print STDERR "[KINTPV Generation] $msg\n";
                }
            }

            # HTML dump
            $parser->dump()
                if $option{dump};
        }
        else {
            die 'Must pass a file to work on. See -h';
        }
    }
    catch {
        croak "Die: $_";
    }
    finally {
        # Cleanup code here
        #if (@_) {
        #    print "The try block died with: (@_)\n";
        #} 
        #else {
        #    print "The try block ran without error.\n";
        #}
    }
}


#----------------------------------------------------------------------------
# HELPERS
#----------------------------------------------------------------------------

__END__

=pod

=head1 cgm.pl

Main entry into MUTINY Tahiti's project CGM module

=head1 SYNOPSIS

cgm.pl [options]

 Options:
    -f <file>  --file <file>     csv file to scan
    -h         --help            Print manual page and exits
    -V         --version         Print software version and exits
    -t         --trace           Turn debug mode on
               --notrace         Turn debug mode off
    -d         --dump            Dump html result STDOUT
               --nodump
    -k <file>  --kintpv <file>   KinTPV-format output filename

=head1 VERSION

Version 0.11  - Mer 18 fév 2015 18:07:33 PST


=head1 OPTIONS

    -f   --file            csv file to work on
    -h   --help            Print manual page and exits
    -V   --version         Print software version and exits
    -t   --trace           Turn debug mode on
         --notrace         Turn debug mode off
    -d   --dump            Dump html result STDOUT
         --nodump

=head1 DIAGNOSTICS

<+DIAGNOSTICS+>

=head1 EXIT STATUS

0 (OK)

=head1 CONFIGURATION

<+CONFIGURATION+>

=head1 DESCRIPTION

<+DESCRIPTION+>

=head1 DEPENDENCIES

 Getopt::Long
 Pod::Usage

=head1 BUGS AND LIMITATIONS

Please report any bug to C<< <franck.porcher at franckys.com> >>

=head1 INCOMPATIBILITIES

Requires Perl 5.14 or higher, with respect to full Unicode support and 'state'
feature.

=head1 SUPPORT

<+SUPPORT+>

=head1 ACKNOWLEDGEMENTS

<+ACKNOWLEDGEMENTS+>

=head1 AUTHOR

Franck PORCHER, C<< <franck.porcher at franckys.com> >>

=head1 LICENSE AND COPYRIGHT

Copyright (C) 2015 - Franck Porcher, Ph.D - All rights reserved

=cut

