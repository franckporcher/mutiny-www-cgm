#===============================================================================
#
#         FILE: Franckys/CGM/Parser/Section/Produits.pm
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
package Franckys::CGM::Parser::Section::Produits;
use version; our $VERSION = 'v0.11';           # Keep on same line
use v5.20;                                      ## no critic (ValuesAndExpressions::ProhibitVersionStrings)
use strict;
use warnings;
use autodie;
use feature             qw( switch say unicode_strings );

use parent              'Franckys::CGM::Parser::AnySection';

# use Carp                qw( carp croak confess cluck );
use Const::Fast;
# use Text::CSV           'v1.32';
# use File::Copy
# use Scalar::Util;
# use Regexp::Common;
# use Path::Class
use Franckys::MuffinMC;

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
const my $KINTPV_FIELD_SEP      => "\t";
const my $KINTPV_QUOTEFIELD     => 0;
const my $KINTPV_QUOTE_WITH     => '"';
const my $KINTPV_EOL            => "\n";
const my $KINTPV_TXT_EOL        => 'Kin_13';
const my $KINTPV_TXT_TAB        => 'Kin_9';

# GLOBALS
my $section;
my $section_name;
my $KINTPVFD;
my $record;
my $record_tag;         # regular(0)  master(1)  declination(2)
my $master_ean13;
my @output_record;

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


#----------------------------------------------------------------------------
# KINTPV Generation Template
#----------------------------------------------------------------------------
my %kintpv_template = (
    Code_Barre
        => sub { 
                if ( $record_tag eq 'regular') {
                    return value_ktpv_field('Code_Barre')
                }
                else {
                    # Compute Master-EAN13 for all products from the declination 
                    ($master_ean13)
                        = get_muffin_eval( sprintf('#(ean13_master %s)', value_ktpv_field('Code_Barre')))
                        if $record_tag eq 'master';

                    return defined $master_ean13 ? $master_ean13 : '';
                }
           },

    Code_Barre_Decli
        => sub { 
                return $record_tag eq 'regular'
                       ? '' 
                       : return value_ktpv_field('Code_Barre')
                       ;
           },

    Reference_Article
        => sub {
                return $output_record[0];
           },

    Ref_Decli
        => sub { 
                return $output_record[1];
           },
    
    # Catégorie parente               
    Type_Article
        => sub {
                my ($top_categorie)
                    = get_muffin_eval(
                        sprintf( '#(top_categorie %s)',
                                 value_field('CategorieID'),
                      ));
                return defined $top_categorie ? $top_categorie : '';
           },
    
    Nom_Article                 
        => sub {
                return value_ktpv_field('Nom_Article');
           },

    # (Critère 8) Sous-Catégorie - Niveau 2              
    Dominant
        => sub {
                my ($sous_categorie)
                    = get_muffin_eval(
                        sprintf( '#(sous_categorie %s)',
                                 value_field('CategorieID'),
                      ));
                return defined $sous_categorie ? $sous_categorie : '';
           },

    # (Critère 9) Nom de la collection
    Saison
        => sub {
                my ($collection_name)
                    = get_muffin_eval(
                        sprintf( '$("Collections.%s.Nom")',
                                 value_field('CollectionID'),
                      ));
                return defined $collection_name ? $collection_name : '';
           },
    
    # (Critère 10) Attribut "Genre" ssi attribut fixe, autrement laisser blanc
    Genre                       => sub { 'Genre' },
    
    # (Critère 11) Attributs fixes qui soient ni 'genre', ni 'couleur'
    Famille                     => sub { 'Famille' },
    
    # (Critère 12) Attribut "Couleur/Texture" ssi attribut fixe, autrement laisser blanc
    Couleur                     => sub { 'Couleur' },
    
    # (Critère 7)
    Marque
        => sub {
                return value_ktpv_field('Marque');
           },
    
    Nom_Fournisseur
        => sub { return value_ktpv_field('Nom_Fournisseur') },
        # Ref_Fournisseur
        # Designation1_Fournisseur
        # Designation2_Fournisseur
    
    # Résumé
    Description
        => sub {
                return value_ktpv_field('Description');
           },

        # VenteEnPortion_0_1      => sub { return 0 },
        # PublierSurWeb_0_1       => sub { return 0 },
        # Poids                   => sub { return 0 },
    
    # AttributsDeclinaisons
    Declinaison                 => sub { 'Declinaisons' },
        # PrixAchat_HT
        # RemisePourcent_PrixAchat
        # FraisApproche_PrixAchat_HT
        # PrixValoStock_PrixAchat_HT	
        # DateApplication_PrixAchat	
    
    TauxTaxe_TVA
        => sub {
                my ($tva) = get_muffin_var('KINTPV.TVA');
                return defined $tva ? $tva : 0;
           },
    
    PrixVente_TTC
        => sub { 
                my (@prix) = values_ktpv_field('PrixVente_TTC');
                my $prix   = 0;
                $prix += $_ foreach @prix;
                return $prix;
           },
    
    DateApplication_PrixVente
        => sub {
                my ($ktpv_date)
                    = get_muffin_eval(
                        sprintf( '#(ktpv_date $("Collections.%s.DateLancement"))',
                                 value_field('CollectionID'),
                      ));
                return defined $ktpv_date ? $ktpv_date : '';
           },
    
    QteEnStock
        => sub {
                return value_ktpv_field('QteEnStock');
           },

        # CmdAuto_StockMini	
        # CmdAuto_Colisage	
        # CmdAuto_QteACommander	
        # Nom_Autre_Fournisseur	
        # Ref_Autre_Fournisseur	
        # Critere_1	
        # Critere_2	
        # Critere_3
        # Critere_4	
        # Critere_5	
        # Critere_6	
        # NumSerie	
        # Ref_Fourn_Decli	
        # Description_Complete Description
        # Meta_Title	
        # Meta_Keyword	
        # Meta_Description	
        # URL_Simple	
        # Categorie_Web	
        # IdExterne
);

my @kintpv_fields = (qw(
    Code_Barre
    Code_Barre_Decli
    Reference_Article
    Ref_Decli
    Type_Article
    Nom_Article
    Dominant
    Saison
    Genre
    Famille
    Couleur
    Marque
    Nom_Fournisseur
    Description
    Declinaison
    TauxTaxe_TVA
    PrixVente_TTC
    DateApplication_PrixVente
    QteEnStock
));

#----------------------------------------------------------------------------
# KINTPV GenerationI/O 
#----------------------------------------------------------------------------
sub to_kintpv {
    my ($self, $kintpvfd) = @_;

    # Publish important data
    $section      = $self;
    $section_name = $self->name();
    $KINTPVFD     = $kintpvfd;

    # Generate Headers
    $self->kintpv_headers();

    # Muffin Formulas
    get_muffin_eval( $_ )
        foreach (
            '=(*
                ktpv_date       F( "!(!:cp :join-with /)@(~($(_1) (..,)) 4 3 2)" )
                ean13_master    F( #(rean13 $(_1) #(ean13_attribut $(KINTPV.EAN13_Master_On))))
                top_categorie   F( @( #(categorie_short_description $(_1)) 1 ) )
                sous_categorie  F( @( #(categorie_short_description $(_1)) 2 ) )
             )',
        );

    # Generate Records
    $self->kintpv_records();

    # The end
    return (0, "ok");
}

###
# SECTION HEADERS
#
# $section->kintpv_headers();
sub kintpv_headers {
    kintpv_output_record( @kintpv_fields );
}


###
# SECTION RECORDS
#
# $section->kintpv_records();
sub kintpv_records {
    my $self = shift;

    foreach my $r ( $self->records() ) {
        $record        = $r;
        @output_record = ();
        $record_tag
            = $record->[0][0] == 0      ? 'regular'      
            : $record->[0][0] == 1      ? 'master'      
            :                             'declination'
            ;

        foreach my $f ( @kintpv_fields ) {
            my $value = $kintpv_template{$f}();
            push @output_record, ( defined $value ? $value : '');
        }

        kintpv_output_record( @output_record );
    }

}


###
sub record_as_html {
    my ($self, $record) = @_;

    my @record_field_values = map {
        my $final = $self->get_record_final_value($record, $_);

          $#$final == -1  ? ''
        : $#$final == 0   ? $final->[0]
        :                   sprintf('(%s)', (join ')(', @{$final}))
        ;
    } 0 .. (scalar(@$record) - 1);
    local $" = '</span><span>';
    "<span>@record_field_values</span>";
}

#----------------------------------------------------------------------------
# KINTPV Generation Helpers
#----------------------------------------------------------------------------
sub get_muffin_var {
    my ($varname) = @_;

    return clean_muffin_stuff( muffin_getval($varname) );
}

sub get_muffin_eval {
    my ($prog) = @_;

    return clean_muffin_stuff( muffin_eval($prog) );
}


sub clean_muffin_stuff {
    my $final = shift;
    return !defined $final        ? ()
         : ref($final) eq 'ARRAY' ? @$final
         :                          ($final)
         ;
}

##
# my $value_str = value_ktpv_field( FIELDNAME )
#
# Extract the final value of a ktpv-indirect-named-field of the record,
#
sub value_ktpv_field {
    my ($ktpv_field) = @_;

    # Get the section field name
    my @section_field_names = get_muffin_var("KINTPV.${ktpv_field}");
    return '' unless @section_field_names;

    # Get the muffin index associated with the muffin section field name
    my @muffin_indexes = map { get_muffin_var("${section_name}.${_}.index") } @section_field_names;

    # Extract the field values
    my @muffin_values
        =  map {
                my $final = $section->get_record_final_value($record, $_ - 1);
                  $#$final == -1  ? ''
                : $#$final == 0   ? $final->[0]
                : @{$final}
           } @muffin_indexes;

    return "@muffin_values";
}

##
# my @values = value_ktpv_field( FIELDNAME )
#
# Extract the final values of a ktpv-indirect-named-field of the record,
#
sub values_ktpv_field {
    my ($ktpv_field) = @_;

    # Get the section field name
    my @section_field_names = get_muffin_var("KINTPV.${ktpv_field}");
    return '' unless @section_field_names;

    # Get the muffin index associated with the muffin section field name
    my @muffin_indexes = map { get_muffin_var("${section_name}.${_}.index") } @section_field_names;

    # Extract the field values
    my @muffin_values
        =  map {
                my $final = $section->get_record_final_value($record, $_ - 1);
                  $#$final == -1  ? ''
                : $#$final == 0   ? $final->[0]
                : @{$final}
           } @muffin_indexes;

    return @muffin_values;
}

##
# my $value_str = value_field( FIELDNAME )
#
# Extract the final value of a named-field of the record,
#
sub value_field {
    my ($field) = @_;

    # Get the muffin index associated with the muffin section field name
    my ($muffin_index) = get_muffin_var("${section_name}.${field}.index");

    # Extract the field values
    if ( defined $muffin_index ) {
        my $final  = $section->get_record_final_value($record, $muffin_index - 1);
        my @muffin_values
            = $#$final == -1  ? ''
            : $#$final == 0   ? $final->[0]
            : @{$final}
            ;
        return "@muffin_values";
    }
    else {
        return '';
    }
}

##
# my @values = values_field( FIELDNAME )
#
# Extract the final values of a named-field of the record,
#
sub values_field {
    my ($field) = @_;

    # Get the muffin index associated with the muffin section field name
    my ($muffin_index) = get_muffin_var("${section_name}.${field}.index");

    # Extract the field values
    if ( defined $muffin_index ) {
        my $final  = $section->get_record_final_value($record, $muffin_index - 1);
        my @muffin_values
            = $#$final == -1  ? ''
            : $#$final == 0   ? $final->[0]
            : @{$final}
            ;
        return @muffin_values;
    }
    else {
        return ();
    }
}

###
# OUTPUT RECORD
#
sub kintpv_output_record {
    my @record
        = map { 
                s/\n/$KINTPV_TXT_EOL/sg;
                s/\t/$KINTPV_TXT_TAB/sg;
                $KINTPV_QUOTEFIELD
                    ? "${KINTPV_QUOTE_WITH}${_}${KINTPV_QUOTE_WITH}" 
                    : $_
          } @_;

    local $" = $KINTPV_FIELD_SEP;

    print $KINTPVFD
        "@record",
        $KINTPV_EOL;
}



#-----
1;
__END__

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
