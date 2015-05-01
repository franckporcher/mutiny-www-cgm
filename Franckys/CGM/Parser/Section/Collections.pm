#===============================================================================
#
#         FILE: Franckys/CGM/Parser/Section/Collections.pm
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
package Franckys::CGM::Parser::Section::Collections;
use version; our $VERSION = 'v0.11';           # Keep on same line
use v5.20;                                      ## no critic (ValuesAndExpressions::ProhibitVersionStrings)
use strict;
use warnings;
use autodie;
use feature             qw( switch say unicode_strings );

use parent              'Franckys::CGM::Parser::AnySection';

# use Carp                qw( carp croak confess cluck );
# use Const::Fast;
# use Text::CSV           'v1.32';
# use File::Copy
# use Scalar::Util;
# use Regexp::Common;
# use Path::Class

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
#   :debug

#----------------------------------------------------------------------------
# GLOBAL OBJECTS AND CONSTANTS
#----------------------------------------------------------------------------
# CONSTANTS

# GLOBALS


#----------------------------------------------------------------------------
# Generic Getters (overload at your own risk)
#----------------------------------------------------------------------------
# my $section_name          = $section->name();
#
# my $nb_fields             = $section->nb_fields();
#
# my @all_headers           = $section->headers();
# my @some_headers          = $section->headers( $index... );
#
# my @all_header_indexes    = $section->header_indexes(); # Returned in numerical sorted order
# my @some_header_indexes   = $section->header_indexes( $header_name...);
#
# my @all_mandatory_fields  = $section->mandatory_fields();
# my @some_mandatory_fields = $section->mandatory_fields( $index... );


# my $headers_verbatim_row  = $section->headers_verbatim_row(); 

# my @verbatim_rows         = $section->verbatim_rows(index, ...); 
# my $nb_verbatim_rows      = $section->nb_verbatim_rows(); 

# my @records               = $section->records(); 
# my $nb_records            = $section->nb_records(); 

# my $field_value           = $section->record_get_value( $record, $field_index );

#----------------------------------------------------------------------------
# MAY BE OVERLOADED
#----------------------------------------------------------------------------
# $section->dump();                         => HTML
# $section->dump_record( $record )          => Called by dump() for each record
# $html                     = $section->record_as_html($record) => HTML, called by above
# my $bool                  = $section->is_field_mandatory($index);
# my $bool                  = $section->need_eval( $field_index );
# my $record                = $section->validate_record( $record );
#----------------------------------------------------------------------------
sub need_eval { 1 };


#-----
1;
__END__
#----------------------------------------------------------------------------
# AUTOMATIC DATA
#----------------------------------------------------------------------------


#----------------------------------------------------------------------------
# DOCUMENTATION
#----------------------------------------------------------------------------
=pod

=head1 Franckys::CGM::Parser::Section::Default

Franckys/CGM/Parser/Section.pm - Provides the generic class
constructor, getters and setters for every specialized specific Section subclasses.
Default to generic handlers if no specialized class exists for any required
section.

=head1 VERSION

Version 0.11 - $(date)

=head1 USAGE

use Franckys::CGM::Parser::Section;

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
 Carp                qw( carp croak confess cluck );
 Const::Fast;
 Text::CSV           'v1.32';

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
