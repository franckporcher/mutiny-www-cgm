#===============================================================================
#
#         FILE: <+FILENAME+>
#
#        USAGE: <+USAGE+>
#
#  DESCRIPTION: <+DESCRIPTION+>
#
#      OPTIONS: <+OPTIONS+>
# REQUIREMENTS: <+REQUIREMENTS+>
#         BUGS: <+BUGS+>
#        NOTES: <+NOTES+>
#
#       AUTHOR: Franck Porcher, Ph.D. - franck.porcher@franckys.com
# ORGANIZATION: Franckys
#      VERSION: v0.11
#      CREATED: Mer 18 fév 2015 21:06:50 PST
#     REVISION: <+REVISION+>
#
# Copyright (C) 1995-2015 - Franck Porcher, Ph.D 
# www.franckys.com
# Tous droits réservés - All rights reserved
#===============================================================================
package Franckys::CGM::Parser;
use version; our $VERSION = 'v0.11';           # Keep on same line
use v5.20;                                      ## no critic (ValuesAndExpressions::ProhibitVersionStrings)
use strict;
use warnings;
use autodie;
use feature             qw( switch say unicode_strings );

use Carp                qw( carp croak confess cluck );
use Const::Fast;
use Text::CSV           'v1.32';
# use File::Copy
# use Scalar::Util;
# use Regexp::Common;
# use Path::Class

use Franckys::Trace;
use Franckys::Error;
use Franckys::CGM::Parser::ParseTree;
use Franckys::CGM::Parser::AnySection;

#----------------------------------------------------------------------------
# UTF8 STUFF
#----------------------------------------------------------------------------
use utf8;
use warnings            FATAL => "utf8";
use charnames           qw( :full :short );
use Encode              qw( encode decode );
use Unicode::Collate;
use Unicode::Normalize  qw( NFD NFC );

#----------------------------------------------------------------------------
# I/O
#----------------------------------------------------------------------------
use open qw( :encoding(UTF-8) :std );

#----------------------------------------------------------------------------
# EXPORTED STUFF
#----------------------------------------------------------------------------
# use Perl6::Export::Attrs;
# USE: sub my_proc :Export(:DEFAULT, :tag) { 3 }
#   :DEFAULT
#   :all
#   :trace
#   :verbose

#----------------------------------------------------------------------------
# GLOBAL OBJECTS AND CONSTANTS
#----------------------------------------------------------------------------
# CONSTANTS
const my $LF     => "$/";
const my $TAB    => "\t";

# GLOBALS

#----------------------------------------------------------------------------
# Constructor
#----------------------------------------------------------------------------
# my $parser | $Error = Franckys::CGM::Parser->new(filename);
sub new ($$) {
    my ($invocant, $filename) = @_;
    my $class = ref($invocant) || $invocant;

    # Franckys::CGM::Parser object
    my $self = bless {} => $class;

    # Brand new CSV Scanner
    $self->{csvparser} = Text::CSV->new ({
        binary              => 1,
        eol                 => $LF,
        sep_char            => $TAB,
        allow_whitespace    => 1,
        blank_is_undef      => 0,
        empty_is_undef      => 0,
        quote_char          => '|',     # '"',
        allow_loose_quotes  => 0,
        escape_char         => '|',     # '\\'
        allow_loose_escapes => 1,       # 0
        always_quote        => 1,       # 0
        quote_space         => 0,       # 1
        quote_binary        => 0,
        quote_null          => 0,
        keep_meta_info      => 0,
        verbatim            => 0,
        auto_diag           => 0,
    })
    or do {
        return Error('ELIB', 'Text::CSV', Text::CSV->error_diag());
    };

    # Blank Parse Tree, the semantic result of the scan
    $self->set_parsetree();

    return $filename ? $self->open_file($filename) : $self;
}

#----------------------------------------------------------------------------
# Getters & Setters
#----------------------------------------------------------------------------
sub set_parsetree    { $_[0]{ parsetree }      = Franckys::CGM::Parser::ParseTree->new() }

sub parsetree        { $_[0]{ parsetree }      }

sub set_filename     { $_[0]{ fd }{ filename } = $_[1] }

sub filename         { $_[0]{ fd }{ filename } }

sub set_filemode     { $_[0]{ fd }{ mode     } = $_[1] }

sub filemode         { $_[0]{ fd }{ mode     } }

sub set_fileuid      { $_[0]{ fd }{ uid      } = $_[1] }

sub fileuid          { $_[0]{ fd }{ uid      } }

sub set_filegid      { $_[0]{ fd }{ gid      } = $_[1] }

sub filegid          { $_[0]{ fd }{ gid      } }

sub set_filesize     { $_[0]{ fd }{ bytesize } = $_[1] }

sub filesize         { $_[0]{ fd }{ bytesize } }

sub set_filehandle   { $_[0]{ fd }{ fh }       = $_[1] }

sub filehandle       { $_[0]{ fd }{ fh }       }

sub csvparser        { $_[0]{ csvparser }      }


#----------------------------------------------------------------------------
# I/O
#----------------------------------------------------------------------------
# my $Error | $parser = $parser->open_file(filename, noreset_flag) {
sub open_file  {
    my ($self, $filename, $noreset_flag) = @_;

    # Open file (slot 'fh')
    return Error('ESTAT', $filename)
        unless -f $filename;

    open my $fh, '<', $filename
       or return Error('EOPEN', $filename);

    # Close current file
    $self->close_file($noreset_flag);

    # Create simple file descriptor to store within object
    my ($mode, $uid, $gid, $bytesize) =  ( stat($filename) )[2,4,5,7];
    $self->set_filehandle ($fh);
    $self->set_filename   ($filename);
    $self->set_filemode   ($mode);
    $self->set_fileuid    ($uid);
    $self->set_filegid    ($gid);
    $self->set_filesize   ($bytesize);

    return $self;
}

# my $parser = $parser->close_file( noreset_flag ) {
sub close_file  {
    my ($self, $noreset_flag) = @_;

    if ( my $fh = $self->filehandle() ) {
        close $fh;

        # Nullify file descriptor
        $self->set_filehandle();
        $self->set_filename();
        $self->set_filemode();
        $self->set_fileuid();
        $self->set_filegid();
        $self->set_filesize();

        # Reuse blank parsetree or reset it
        unless ( $noreset_flag ) {
            my $parsetree = $self->parsetree();
            $self->set_parsetree()
                if $parsetree->nb_rows() > 0;
        }
    }

    return $self;
}

#----------------------------------------------------------------------------
# Generic Parser
#----------------------------------------------------------------------------
# my $parser | $Error = $batch->parse_file( filename... );
# Allows to merge several files in one parsetree
# Stop over the first I/O error
sub batch {
    my ($self, @files) = @_;

    $self->close_file();
    return $self unless @files; # so batch()->parsetree()->nb_rows() ==> 0

    foreach my $filename ( @files ) {
        my $cr = $self->parse_file($filename, 1);
        return $cr 
            if Franckys::Error::is_error($cr);
    }

    return $self;
}

# my $parser | $Error = $parser->parse_file( filename [, noreset_flag ] );
sub parse_file {
    my ($self, $filename, $noreset_flag) = @_;

    # Open file
    if ($filename) {
        $self->close_file( $noreset_flag );
        my $cr = $self->open_file( $filename, $noreset_flag );
        return $cr 
            if Franckys::Error::is_error($cr);
    }

    my $csvparser = $self->csvparser();
    my $fh        = $self->filehandle();
    my $parsetree = $self->parsetree();

    # Parse CSV File
    my $current_section_name = '';
    while ( my $row = $csvparser->getline($fh) ) {
        # UTF8 
        $row->[$_] = NFD( $row->[$_] ) foreach 0..$#$row;

        # Set data section
        my $row_section_name  = $row->[0];
        $current_section_name = $row_section_name if $row_section_name;

        # Parse data into section
        if ( $parsetree->is_row_blank($row) ) {
            $parsetree->incr_nb_blank_rows();
        }
        elsif ($current_section_name) {
            #say "[$section_name] @$row";
            my $section = Franckys::CGM::Parser::AnySection->parse_row($current_section_name, $row);
            $parsetree->set_section($current_section_name, $section);
        }
        else {
            # Cannot attach csv record to any section => discard it !
            $parsetree->discard_rows($row);
        }

        # Keep count of number of csv records, parsed, blank, or discarded altogether
        $parsetree->incr_nb_rows();
    }

    return $self;
}

#----------------------------------------------------------------------------
# I/O 
#----------------------------------------------------------------------------
sub dump {
    my $self = shift;
    say <<'EOHTML';
<!DOCTYPE html>
<html lang="fr">
 <head>
  <meta charset="utf-8" />
 </head>
 <body>
  <h1>Source</h1>
  <dl>
EOHTML
    say sprintf('<dt>%s</dt><dd>%s</dd>', @$_)
        foreach (
            [ 'Fichier:', $self->filename               ],
            [ 'Mode:'   , $self->filemode               ],
            [ 'Uid:'    , $self->fileuid                ],
            [ 'Gid:'    , $self->filegid                ],
            [ 'Size:'   , $self->filesize . ' bytes'    ],
    );
    say '  </dl>';

    $self->parsetree()->dump();

    say <<"EOHTML";
  <div class='footer'>
    <p>Rapport d'exécution produit le : ${ \(scalar localtime) }</p>
  </div>
 </body>
</html>
EOHTML
}

#--------
1;
__END__
#----------------------------------------------------------------------------
# AUTOMATIC DATA
#----------------------------------------------------------------------------


#----------------------------------------------------------------------------
# DOCUMENTATION
#----------------------------------------------------------------------------
=pod

=head1 NAME

<+FILE+> - <+DESCRIPTION+>

=head1 VERSION

Version 0.11 - $(date)

=head1 USAGE

 <+FILE+> [OPTIONS]

=head1 REQUIRED ARGUMENTS

<+REQUIREDi ARGUMENTS+>

=head1 OPTIONS

    -h   --help            print manual page and exits
    -V   --version         print software version and exits
    hours) and now 

=head1 DIAGNOSTICS

<+DIAGNOSTICS+>

=head1 EXIT STATUS

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

# Requires Perl 5.14 or higher, with respect to full Unicode support and 'state' feature.

=head1 SUPPORT

<+SUPPORT+>

=head1 ACKNOWLEDGEMENTS

<+ACKNOWLEDGEMENTS+>

=head1 AUTHOR

Franck PORCHER, C<< <franck.porcher at franckys.com> >>

=head1 LICENSE AND COPYRIGHT

Copyright (C) 2015 - Franck Porcher, Ph.D - All rights reserved

=cut
