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
package Franckys::CGM::Parser::ParseTree;
use version; our $VERSION = 'v0.11';           # Keep on same line
use v5.20;                                      ## no critic (ValuesAndExpressions::ProhibitVersionStrings)
use strict;
use warnings;
use autodie;
use feature             qw( switch say unicode_strings );

# use Carp                qw( carp croak confess cluck );
# use Const::Fast;
# use File::Copy
# use Scalar::Util;
# use Regexp::Common;
# use Path::Class

use Franckys::Error;

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
use Perl6::Export::Attrs;
# USE: sub my_proc :Export(:DEFAULT, :tag) { 3 }
#   :DEFAULT
#   :all
#   :trace
#   :verbose

#----------------------------------------------------------------------------
# GLOBAL OBJECTS AND CONSTANTS
#----------------------------------------------------------------------------
# CONSTANTS

# GLOBALS

#----------------------------------------------------------------------------
# CONSTRUCTEUR
#----------------------------------------------------------------------------
# my $parsetree = Franckys::CGM::Parser::ParseTree->new();
sub new ($$) {
    my ($invocant, $filename) = @_;
    my $class = ref($invocant) || $invocant;

    # Franckys::CGM::Parser::ParseTree object
    return bless {
        _NB_ROWS_          => 0,
        _NB_BLANKS_        => 0,
        _NB_DISCARDED_     => 0,
        _NB_ERRORS_        => 0,
        _DISCARDED_        => [],      # [ row... ]
        _ERRORS_           => {},      # { <lineno>        => [err...],     ...} /!\ lineno compté à 1 !
        _SECTIONS_         => {},      # { <section_name>  => $section_obj, ...}
        _SECTIONS_ORDERED_ => [],      # [ $section_obj, ... ]
    } => $class;
}

#----------------------------------------------------------------------------
# CONSTRUCTEUR
#----------------------------------------------------------------------------
# $section | $Error = $parsetree->set_section($section_name, $section);
sub set_section {
    my ($self, $section_name, $error_or_section) = @_;

    if ( my $error
            = Franckys::Error::is_error($error_or_section)
              ? $error_or_section
              : $error_or_section->has_error()
    ) {
        # $error_or_section is now an Error object
        $self->set_errors( $error->msgs() );
    }
    # $section may be passed back thru datum
    #($section) = $error->data();

    if ( $error_or_section->isa('Franckys::CGM::Parser::AnySection')
         && ! exists $self->{ _SECTIONS_ }{ $section_name }
    ) {
        $self->{ _SECTIONS_ }{ $section_name } = $error_or_section;
        push @{ $self->{ _SECTIONS_ORDERED_ } }, $error_or_section;
    }

    return $error_or_section;
}

#----------------------------------------------------------------------------
# PREDICATS
#----------------------------------------------------------------------------
# my $bool = $parsetree->is_row_blank( $row );
sub is_row_blank {
    my ($self, $row) = @_;
    "@$row" =~ /^[\h\v]*$/;
}

#----------------------------------------------------------------------------
# GETTERS / SETTERS
#----------------------------------------------------------------------------
# my $parsetree = $parsetree->incr_nb_rows( $n );
sub incr_nb_rows {
    my ($self, $n) = @_;
    $self->{ _NB_ROWS_} += $n || 1;
    return $self;
}
# my $nb_rows = $parsetree->nb_rows();
sub nb_rows {
    $_[0]{ _NB_ROWS_};
}

# my $parsetree = $parsetree->incr_nb_blank_rows( $n );
sub incr_nb_blank_rows {
    my ($self, $n) = @_;
    $self->{ _NB_BLANKS_} += $n || 1;
    return $self;
}

# my $nb_blanks = $parsetree->nb_blank_rows();
sub nb_blank_rows {
    $_[0]{ _NB_BLANKS_};
}

# $parsetree = $parsetree->discard_rows($row...);
sub discard_rows {
    my ($self, @rows) = @_;

    if (@rows) {
        push @{ $self->{ _DISCARDED_ } }, @rows;
        $self->{ _NB_DISCARDED_ } += @rows;
    }

    return $self;
}

# my $n = $parsetree->nb_discarded_rows();
sub nb_discarded_rows {
    $_[0]{ _NB_DISCARDED_ };
}

# my @discarded_rows = $parsetree->discarded_rows();
sub discarded_rows {
    @{ $_[0]{ _DISCARDED_ } };
}

# $parsetree = $parsetree->set_errors($err...);
sub set_errors {
    my $self = shift;

    if (@_) {
        my $lineno = $self->nb_rows() + 1;       # /!\ Compté à 1
        $self->{ _ERRORS_    }{ $lineno } = [ @_ ];
        $self->{ _NB_ERRORS_ } += @_;
    }

    return $self;
}

# my $n = $parsetree->nb_errors();
sub nb_errors {
    $_[0]{ _NB_ERRORS_ };
}

# my %errors = $parsetree->errors();
sub errors {
    %{ $_[0]{ _ERRORS_ } };
}

# my @all_sections = $parsetree->get_sections();
# my @some_sections = $parsetree->get_sections( $section_name, ...);
sub get_sections {
    my ($self, @section_names) = @_;

    return @section_names
           ? @{ $self->{ _SECTIONS_ } }{@section_names}
           : @{ $self->{ _SECTIONS_ORDERED_ } }
           ;
}

#----------------------------------------------------------------------------
# I/O
#----------------------------------------------------------------------------
sub dump {
    my $self = shift;

    my $nb_errors = $self->nb_errors();

    say sprintf <<"EOHTML";
  <h1>Rapport d'Analyse</h1>
    <dl>
      <dt>Nombre de lignes analysées :</dt><dd>${ \$self->nb_rows }</dd>
      <dt>Nombre de lignes non significatives (vides) :</dt><dd>${ \$self->nb_blank_rows }</dd>
      <dt>Nombre de lignes rattachées à aucune section (non prises en compte) :</dt><dd>${ \$self->nb_discarded_rows }</dd>
      <dt>Nombre global d'erreurs :</dt><dd>$nb_errors</dd>
    </dl>
EOHTML

    if ( $nb_errors ) {
        say sprintf <<'EOHTML';
    <h2>Erreurs</h2>
      <ul>
EOHTML

        my %errors = $self->errors();
        foreach my $lineno ( sort { $a <=> $b } keys %errors ) {
            say "<li>Ligne: $lineno<ul>";
                say sprintf('<li>%s>/li>', $_) foreach @{ $errors{$lineno} };
            say '</ul></li>';
        }
        say '</ul>';
    }

    $_->dump() foreach $self->get_sections();
}


#----------------------------------------------------------------------------
# KINTPV GenerationI/O 
#----------------------------------------------------------------------------
sub to_kintpv {
    my ($self, $kintpvfd) = @_;

    foreach my $section ( $self->get_sections()) {
        my ($cr, $msg) = $section->to_kintpv( $kintpvfd );
        return ($cr, $msg) if $cr;
    }

    return (0, "ok");
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
