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
use Franckys::Trace;

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
my $decli_ean13;
my @output_record;
my $RN;
my $ROW;
my $V5 = 0;
my $V6 = 0;

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
my @kintpv_fields = ();

my %kintpv_template;
   %kintpv_template = (
    ## FIELD_NAME   => [ OUTPUT_POSITION, GENERATION_ORDER, GENERATOR ] 

    # 1. V5/V6. Regular  : Code Barre actuel du produit
    #    V6. Déclinaison : Code barre master
    Code_Barre  => [ 1, 0,
            sub {
                my ($field_name, $field_output_position) = @_;

                my $ean13 =  value_ktpv_field('Code_Barre');

                if ( $record_tag eq 'regular') {
                    # Regular record
                    return $ean13
                }
                else {
                    # Déclinaison record 

                    if ($record_tag eq 'master') {
                        # Compute Master-EAN13 for all products from the declination 
                        # as a unique reference
                        $master_ean13 = get_muffin_eval_final( "#(_ean13_master $ean13)" );
                        $master_ean13 = '' unless defined $master_ean13;
                    }

                    return $V5 ? $ean13 : $master_ean13;
                }
    }],

    # 2. V5/V6. Regular  : As-is, ou code_barre du produit
    #    V5. Déclinaison : As-is, ou code_barre master
    #    V6. Déclinaison : code_barre master
    Reference_Article => [ 0, 1,
            sub { 
                my ($field_name, $field_output_position) = @_;

                my $ean13
                    =  $output_record[
                            $kintpv_template{'Code_Barre'}[0]
                       ];

                my $ref_article =  value_ktpv_field('Reference_Produit');

                if ( $record_tag eq 'regular') {
                    return $ref_article || $ean13;
                }
                elsif ($V5) {
                    return $ref_article || $master_ean13;
                }
                elsif ($V6) {
                    return $master_ean13;
                }
                else {
                    return $ref_article;
                }
    }],

    # 3. Top Catégorie
    Type_Article => [ 2, 2,
            sub {
                return get_muffin_eval_final( '#(produit_top_categorie)' );
    }],
    
    # 4. Nom du produit
    Nom_Article => [ 3, 3,
            sub {
                return value_ktpv_field('Nom_Article');
    }],

    # 5. Sous-Catégorie (Critère 8) - Niveau 2 des catégories
    Dominant    => [ 4, 4,
            sub {
                return get_muffin_eval_final( '#(produit_sous_categorie)' );
    }],

    # 6. Nom de la collection dans (Critère 9)
    Saison      => [ 5, 5,
            sub {
                return get_muffin_var_final(
                        sprintf( 'Collections.%s.Nom',
                                 value_ktpv_field('Collection_ID'),
                      ));
    }],
    
    # 7. Attribut *fixe* "Genre" dans (Critère 10). Vide si n'existe pas
    Genre       => [ 6, 6,
            sub {
                my $genre_attrname = get_muffin_var_final('KINTPV.Attr_Genre');
                return get_muffin_eval_final( "#(_ktpv_value_attr_fixe $genre_attrname)" );
    }],
    
    # 8. Attribut *fixes* autre que "Genre" et "Couleur" dans (Critère 11). Vide si n'existe pas
    Famille     => [ 7, 7,
            sub {
                return '';
    }],
    
    # 9. Attribut *fixe* "Couleur/Texture" dans (Critère 12). Vide si n'existe pas
    Couleur     => [ 8, 8,
            sub {
                my $couleur_attrname = get_muffin_var_final('KINTPV.Attr_Couleur');
                return $couleur_attrname 
                    ?  get_muffin_eval_final( "#(_ktpv_value_attr_fixe $couleur_attrname)" )
                    : $couleur_attrname
                    ;
    }],
    
    # 10. Marque (Critère 7)
    Marque      => [ 9, 9,
            sub {
                return value_ktpv_field('Marque');
    }],
    
    # 11. Nom du fournisseur
    Nom_Fournisseur => [ 10, 10,
            sub { 
                return value_ktpv_field('Nom_Fournisseur');
    }],
        # Ref_Fournisseur
        # Designation1_Fournisseur
        # Designation2_Fournisseur
    
    # 12. V5 - Description du produit ou déclinaison
    #     V6 - Description du produit doit être invariante par déclinaison PB!!!
    Description => [ 11, 11,
            sub {
                return value_ktpv_field('Description');
    }],

        # VenteEnPortion_0_1      => sub { return 0 },
        # PublierSurWeb_0_1       => sub { return 0 },
        # Poids                   => sub { return 0 },
    
    # 13. Spécification de la déclinaison du produit
    Declinaison => [ 12, 12,
            sub {
                return get_muffin_eval_final( '#(_ktpv_declinaison)' );
    }],
        # PrixAchat_HT
        # RemisePourcent_PrixAchat
        # FraisApproche_PrixAchat_HT
        # PrixValoStock_PrixAchat_HT	
        # DateApplication_PrixAchat	
    
    # 14. Taux TVA
    TauxTaxe_TVA    => [ 13, 13,
            sub {
                return get_muffin_var_final('KINTPV.TVA');
    }],
    
    # 15. Prix vente TTC
    PrixVente_TTC   => [ 14, 14, 
            sub { 
                my (@prix) = values_ktpv_field('PrixVente_TTC');

                my $prix   = 0;
                $prix += $_ foreach @prix;

                my $facteur_prix = values_ktpv_field('facteur_Prix');
                $facteur_prix = 1 unless defined $facteur_prix;

                return $prix * $facteur_prix;
    }],
    
    # 16. Date application du prix de vente TTC
    DateApplication_PrixVente => [ 15, 15, 
            sub {
                return get_muffin_eval_final(
                        sprintf( '#(_ktpv_date $("Collections.%s.DateLancement"))',
                                 value_ktpv_field('Collection_ID'),
                      ));
    }],
    
    # 17. Entrée en stock
    QteEnStock  => [ 16, 16,
            sub {
                return value_ktpv_field('QteEnStock');
    }],

    # 18. V6_ONLY - Code Barre Déclinaison Produit (si déclinaison, autrement vide)
    Code_Barre_Decli => [ 18, 17,
            sub { 
                return $record_tag eq 'regular'
                       ? '' 
                       : value_ktpv_field('Code_Barre')
                       ;
    }],

    # 19. V6_ONLY - Référence Déclinaison Produit (== code_barre déclinaison, si déclinaison, autrement vide)
    Ref_Decli   => [ 17, 18,
            sub { 
                return $record_tag eq 'regular'
                    ? ''
                    :   value_ktpv_field('Reference_Produit')
                        || $output_record[
                                $kintpv_template{'Code_Barre_Decli'}[0]
                            ];

    }],

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


#----------------------------------------------------------------------------
# KINTPV Generation
#----------------------------------------------------------------------------
sub to_kintpv {
    my ($self, $kintpvfd, $k_version) = @_;

    # Publish important data
    $V5           = $k_version eq 'v5';
    $V6           = $k_version eq 'v6';
    $section      = $self;
    $section_name = $self->name();
    $KINTPVFD     = $kintpvfd;

    # Fields
    @kintpv_fields
    = $V5
        ## KINTPV V5 ##
        ? (qw(
            Code_Barre
            Reference_Article
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
        ))
        ## KINTPV V6 ##
        : (qw(
            Reference_Article
            Code_Barre
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
            Ref_Decli
            Code_Barre_Decli
        ))
        ;

    # Generate Headers
    $self->kintpv_headers();

    # Muffin Formulas
    _muffin_eval( $_ )
        foreach (
            '=(*
                _ktpv_date               F( "!(!:cp :join-with /)@(~($(_1) (..,)) 4 3 2)" )
                _ean13_master            F( #(rean13 $(_1) #(ean13_attribut $(KINTPV.Attr_EAN13_Master))))
                _attributs_declinaison   F( S("$(ROW).$(KINTPV.Attributs_Declinaisons)") )
                _attributs_fixes         F( S("$(ROW).$(KINTPV.Attributs_Fixes)") )
            )',

            # (_ktpv_declinaison)  "MODEL=2 TH=3 CT=4"  -->  "Modèle=Mutiny Sport:Taille=Large:Couleur_Testure=Bleu"
            '=(*
                _ktpv_declinaison        F( "( !(:join-with :)  
                                               #( !(:by 2) 
                                                  map 
                                                     F( "$("$(_1).Nom")=$("$(_1)[$(_2)]")"       )  
                                                     S( !(:split-on =) #(_attributs_declinaison) )
                                                )
                                              )
                                           )
             )',

            # (_ktpv_value_attr_fixe  GENRE) -> $(GENRE[3]) -> Homme
            '=(*
                _ktpv_value_attr_fixe       F( $("$(_1)[~( !(:match-first) #(_attributs_fixes) "$(_1)=*")]") )
             )',

        );

    # Generate Records
    $self->kintpv_records();

    # The end
    return (0, "ok");
}

##
# GENERATE SECTION HEADERS
#
# $section->kintpv_headers();
#
sub kintpv_headers {
    kintpv_output_record( 
        sort {
            $kintpv_template{$a}[0] <=> $kintpv_template{$b}[0]
        } @kintpv_fields
    );
}

##
# GENERATE SECTION RECORDS
#
# $section->kintpv_records();
#
sub kintpv_records {
    my $self = shift;

    # Install Muffin indexes
    # Allows to use taditional Muffin vars, like RN, ROW, FN, SN
    # (be warned that Field indexes are not kept : FN CELL)
    $RN         = 1;
    $ROW        = "${section_name}[$RN]";
    muffin_setvar( RN  => sub { return [ $RN  ] } );
    muffin_setvar( ROW => sub { return [ $ROW ] } );

    my ($op, $r, $field_name, $field_output_position, $field_generation_order, $field_generator);

    foreach $r ( $self->records() ) {
        $record = $r;

        # Generate records that satisfy requirements only
        if ( $op = kintpv_valid_record() ) {
            @output_record = ();

            $record_tag
                = $record->[0][0] == 0      ? 'regular'      
                : $record->[0][0] == 1      ? 'master'      
                :                             'declination'
                ;


            foreach my $field_name ( 
                sort { 
                    $kintpv_template{$a}[1] <=> $kintpv_template{$b}[1]
                } @kintpv_fields
            ) {
                ($field_output_position, $field_generation_order, $field_generator) = @{ $kintpv_template{$field_name} };

                my $value 
                    =   $field_generator
                        ?  $field_generator->($field_name, $field_output_position)
                        :  'NO_GENPROC_FOR_FIELD_${f}'
                        ;

                $output_record[$field_output_position] = defined $value ? $value : '';
            }

            kintpv_output_record( @output_record );
        }

        # Keep muffin indexes updated
        $RN++;
        $ROW = "${section_name}[$RN]";
    }
}

# my $op | undef = kintpv_valid_record();
sub kintpv_valid_record {
    my $ppt_store_code = get_muffin_var_final('Store.PPT');

    my $op            = value_ktpv_field('Operation');
    # my $est_actif     = value_ktpv_field('Est_Actif');
    # my $store         = value_ktpv_field('Store');
    # print "(ROW:$ROW) OP:$op EstActif:$est_actif Store:$store\n";

    return 
        (   $op !~ m/^nop$/si
            && value_ktpv_field('Est_Actif')
            && value_ktpv_field('Store') =~ m/\b$ppt_store_code\b/is
        ) ? $op : undef;
}


#----------------------------------------------------------------------------
# KINTPV MuffinMC Helpers
#----------------------------------------------------------------------------
sub _muffin_setvar {
    my ($varname, @values) = @_;
    return  muffin_setvar($varname, \@values);
}


sub _muffin_getval {
    my ($varname) = @_;
    return  muffin_getval($varname, $section);
}

sub get_muffin_var {
    return clean_muffin_stuff( _muffin_getval(@_) );
}

sub get_muffin_var_final {
    my @final = get_muffin_var(@_);
    "@final";
}


sub _muffin_eval {
    my ($prog) = @_;
    return  muffin_eval($prog, $section);
}

sub get_muffin_eval {
    return clean_muffin_stuff( _muffin_eval(@_) );
}

sub get_muffin_eval_final {
    my @final = get_muffin_eval(@_);
    "@final";
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
    my $ktpv_field = shift;
    my @final = values_ktpv_field($ktpv_field);
    return "@final";
}

##
# my @values = value_ktpv_field( FIELDNAME )
#
# Extract the final values of a ktpv-indirect-named-field of the record,
#
sub values_ktpv_field {
    my $ktpv_field = shift;

    # Get the section field name
    my @section_field_names = get_muffin_var("KINTPV.${ktpv_field}");
    return '' unless @section_field_names;

    # Extract the values from the record's fieldnames
    return map { values_field($_) } @section_field_names;
}

##
# my $final_value_str = value_field( FIELDNAME )
#
# Extract the final value of a named-field of the record,
#
sub value_field {
    my $fieldname = shift;
    my @final = values_field( $fieldname );
    return "@final";
}

##
# my @final_values = values_field( FIELDNAME )
#
# Extract the final values of a named-field of the record,
#
sub values_field {
    my $fieldname = shift;
    return get_muffin_var("${ROW}.${fieldname}");
}


#----------------------------------------------------------------------------
# KINTPV IO Helpers
#----------------------------------------------------------------------------
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
