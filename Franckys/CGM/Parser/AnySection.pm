#===============================================================================
#
#         FILE: Franckys/CGM/Parser/AnySection.pm
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
package Franckys::CGM::Parser::AnySection;
use version; our $VERSION = 'v0.11';           # Keep on same line
use v5.20;                                      ## no critic (ValuesAndExpressions::ProhibitVersionStrings)
use strict;
use warnings;
use autodie;
use feature             qw( switch say unicode_strings );

# use Carp                qw( carp croak confess cluck );
use Const::Fast;
# use Text::CSV           'v1.32';
# use File::Copy
# use Scalar::Util;
# use Regexp::Common;
# use Path::Class

use Franckys::MuffinMC;
use Franckys::Error;
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

(*STDOUT{IO})->autoflush(1);

#----------------------------------------------------------------------------
# GLOBAL OBJECTS AND CONSTANTS
#----------------------------------------------------------------------------
# CONSTANTS
const my $IS_MANDATORY_FIELD_DEFAULT_FLAG    => 0; 
const my $IS_TEMPLATE_FIELD_DEFAULT_FLAG     => 0; 

# GLOBALS
my %Regex = (
    leading_spaces          => qr|^[[:space:]]+|,
    trailing_spaces         => qr|[[:space:]]+$|,
    is_mandatory_field      => qr/[\pL\pN][+]?[*][+]?$/,
    is_template_field       => qr/[\pL\pN][*]?[+][*]?$/,
    clean_header            => qr|[*+]+$|,
    empty_field             => qr|^[[:space:]]*$|,
);

my $Section = bless {} => __PACKAGE__;

#----------------------------------------------------------------------------
# BEGIN
#----------------------------------------------------------------------------
    sub _init {
        Franckys::Error::def_error(DATA_MISSING    => 'Section:[%s] Colonne:[%d] - Le champ:[%s] est requis, mais sa valeur est absente.');
        Franckys::Error::def_error(EVAR            => 'Section:[%s] Colonne:[%d] - Variable indéfinie:[%s].');
        Franckys::Error::def_error(EFUNC           => 'Section:[%s] Colonne:[%d] - Evaluation fonctionnelle:[%s].');
        Franckys::Error::def_error(EARG            => 'Argument manquant:[%s].');
    
        #--- MUFFINMC SPECIAL VARIABLES (AUTOMATICALLY UPDATED)
        __PACKAGE__->set_muffin_variable( 'SN'  => sub { [ $_[0]->name()              ] });  # Section Name 
        __PACKAGE__->set_muffin_variable( 'SFN' => sub { [ $_[0]->headers( get_IFN() )] });  # Section Field Name
        __PACKAGE__->set_muffin_variable( 'RN'  => sub { [ $_[0]->nb_records() + 1    ] });  # Record Number (per section)
        __PACKAGE__->set_muffin_variable( 'FN'  => sub { [ get_IFN() + 1              ] });  # Field Number [1..NF], per section, set by the section's headers
        __PACKAGE__->set_muffin_variable( 'NF'  => sub { [ $_[0]->nb_fields()         ] });  # Number of fields, per section, set by the section's headers
        __PACKAGE__->set_muffin_variable( 'NIL' =>       [   ]                           );  # NIL VALUE
        __PACKAGE__->set_muffin_variable( 'ZERO'=>       [ 0 ]                           );
        __PACKAGE__->set_muffin_variable( 'UN'  =>       [ 1 ]                           );
        __PACKAGE__->set_muffin_variable( 'CR'  =>       [ "\n" ]                        );
        __PACKAGE__->set_muffin_variable( 'TAB' =>       [ "\t" ]                        );

        #--- MUFFINMC SPECIAL VARIABLES (SET ONCE FOR ALL ; SORT OF ALIASES; TO BE EXPANDED AT USE)
        __PACKAGE__->set_muffin_variable( 'ROW'     => '"$(SN)[$(RN)]"' );                   # ROW, to be used in $(.xxx) => $($(ROW).xxx)
        __PACKAGE__->set_muffin_variable( 'CELL'    => '"$(ROW)[$(FN)]"' );                  # CELL, for use as function args...

        eval sprintf('%s::_init=sub{}', __PACKAGE__);
    }

#----------------------------------------------------------------------------
# Generic Constructor and Parser methods for all section types
#----------------------------------------------------------------------------

# Where everything starts !
# Create a new section if section does not exist, with the row
# as a header row.
# Otherwise parse the row with the section parser_row own method
#
# my $section | $Error = $self->parse_row($section_name, $row)
sub parse_row {
    my ($self, $section_name, $row) = @_;
    tracein($section_name, $row);

    # Use existing specialized section
    if ( my $section = $self->get_section( $section_name ) ) {
        # Start a new csv record, free of any syntactic / semantic error 
        $section->reset_error();

        # Ignore recurring section headers
        # A situation that may happen if a section is repeated several times 
        # within a given file, or if we are actually handling a batch of
        # files that, also, can individually repeat the header sections.
        # First column is set ONLY for Section headers 
        return $section
            if $row->[0];

        # Record raw row
        $section->add_verbatim_row( $row );

        # Per-Section specialized parsing and record generation
        # Syntactic / Semantic error are set in $section->has_error() 
        $section->generate_records($row);
        traceout( );
        return $section;
    }

    # Create specialized section
    else {
        trace(ref($self) || $self, 'parse_row', ' -- Section:[%s] does not exist', $section_name);
        my $class = sprintf('Franckys::CGM::Parser::Section::%s', $section_name);
        eval {
            unless (eval "require $class") {
                $class = sprintf('Franckys::CGM::Parser::Section::%s', 'Default');
                eval "require $class";
            }
        };
        trace(ref($self) || $self, 'parse_row', ' - Section:[%s] will be handled by class:[%s]', $section_name, $class);

        # Create the new section handled by type $class
        traceout();
        return $class->new(section_name => $section_name, section_headers => $row);
    }
}

# my $section_obj | $Error = Franckys::CGM::Parser::Section->new(
#       section_name        => $section_name        (String)
#       section_headers     => $headers_row         (Reference on an array of strings, 
#                                               one for each header, if any)
# );
#
# If error, returns undef with the errors in $@
sub new {
    my $invocant = shift;
    my $class    = ref($invocant) || $invocant;
    trace($class, @_);

    # INIT
    _init();

    # Return Section's object if it already exists
    my %params          = @_;
    my $section_name    = $params{section_name};
    my $section_headers = $params{section_headers};

    # Section name is mandatory
    return Franckys::Error::Error('EARG', 'section_name')
        unless $section_name;

    # Is there an existing entry for $section_name ?
    my $section = $class->get_section( $section_name );
    return $section if $section;

    # Headers are mandatory for a new section
    return Franckys::Error::Error('EARG', 'section_headers')
        unless $section_headers;

    # Create a new section
    $section = bless {
        error                => Franckys::Error::Error(),      # Error object. Resetted before parsing any new csv record.
        name                 => $section_name,          # Section name.
        #--- Headers 
        nb_fields            => scalar(@{ $section_headers }),  # Number of fields in section related csv records (set by number of headers).
        headers              => [],                     # Column-ordered list of normalized header names (index -> headername).
        headers_verbatim_row => $section_headers,       # Column-ordered list of normalized header names (index -> headername).
        #--- CSV data, unparsed(rows) and parsed(records)
        verbatim_rows        => [],                     # Ordered list of verbatim copies of csv records parsed
        records              => [],                     # Parsed records (Section specific)
        nb_records           => 0,                      # Number of records
    } => $class;

    # Record's data starts at the second column1 in the CSV's raw row
    # Index 0 (first column) is *always* reserved to the section name
    my ( $header,
         $field_index,
         $is_mandatory_flag,
         $is_template_flag,
    );

    $field_index = 0;                              

    foreach $header ( @{ $section_headers } ) {
        # Header name 
        $section->chomp_spaces( $header );

        # Field flags
        $is_mandatory_flag
            = $header =~ /$Regex{is_mandatory_field}/
                ? 1
                : $IS_MANDATORY_FIELD_DEFAULT_FLAG;

        $is_template_flag
            = $header =~ /$Regex{is_template_field}/
                ? 1
                : $IS_TEMPLATE_FIELD_DEFAULT_FLAG;

        # Clean header
        $header =~ s/$Regex{clean_header}//;

        # Set Section Field Variables (MuffinMC)
        $section->set_muffin_headerfield_variables(
            $section_name,
            $header,
            $field_index,
            $is_mandatory_flag,
            $is_template_flag,
        );

        # Set object internal data
        $section->{ headers          }[ $field_index ] = $header;

        # Next field
        $field_index++;
    }

    # Define the MuffinMC Section variable $(<section_name>) to point on all records of the section
    $section->set_muffin_variable( $section_name, $section->{records} );   # share memory => [ record... ]

    # Store and return newly created section object
    $Section->{ $section_name } = $section;
}


#----------------------------------------------------------------------------
# Error handling (relies on Franckys::Error mechanism)
#----------------------------------------------------------------------------

# (void) $section->reset_error();
sub reset_error {
    my $section = shift;
    $section->{error} = Franckys::Error::Error();
}

# undef | $Franckys::Error = $section->has_error();
sub has_error {
    my $section = shift;
    my $error   = $section->{error};
    return $error->nb_errors() > 0 
        ? $error
        : undef
        ;
}

# my $Franckys::Error = $section->set_error($err_tag, @params);
#
# /!\ Must return a Franckys::Error object that accepts as_string() method.
sub set_error {
    my ($self, $err_tag, @params) = @_;

    return $self->{error}->Error(
        $err_tag, 
        [   $self->name(), 
            get_IFN() + 1, 
            "@params",
        ],
        $self, # $section transmitted as datum
    ); 
}

#----------------------------------------------------------------------------
# Getters / Setters
#----------------------------------------------------------------------------
# my $section_name = $section->name();
sub name {
    $_[0]{name};
}

# my $nb_fields = $section->nb_fields();
sub nb_fields {
    $_[0]{nb_fields};
}

# my @all_headers  = $section->headers();
# my @some_headers = $section->headers( $index... );
sub headers {
    my $self = shift;

    @_ = ( 0 .. ($self->nb_fields - 1) )
        unless @_;

    my $section_name = $self->name();
    map {
            $self->get_muffin_variable(
                sprintf('%s[%d].header', $section_name, $_ + 1)
            )->[0]
    } @_;
}

# my $section = $section->set_headers_verbatim_row( $headers_row ); 
sub set_headers_verbatim_row {
    my ($self, $headers_row) = @_;

    $self->{headers_verbatim_row} = $headers_row;

    $self;
}

# my $headers_verbatim_row = $section->headers_verbatim_row(); 
sub headers_verbatim_row {
    $_[0]{headers_verbatim_row};
}

# my $section = $section->add_verbatim_row( $row );
sub add_verbatim_row {
    my ($self, $row) = @_;

    push @{ $self->{verbatim_rows} }, $row;

    $self;
}

# my @verbatim_rows = $section->verbatim_rows(index, ...); 
sub verbatim_rows {
    @{ $_[0]{verbatim_rows} };
}

# my $nb_verbatim_rows = $section->nb_verbatim_rows(); 
sub nb_verbatim_rows {
    scalar( $_[0]->verbatim_rows() );
}

# my $section = $section->add_record(record); 
sub add_record {
    my ($self, $record) = @_;

    $self->{records}[ $self->{ nb_records }++ ] = $record;

    $self;
}

# my @records = $section->records(); 
sub records {
    @{ $_[0]{records} };
}

# my $nb_records = $section->nb_records(); 
sub nb_records {
    $_[0]{ nb_records };
}

#----------------------------------------------------------------------------
# Predicates
#----------------------------------------------------------------------------
# $section | undef = self->get_section( $section_name ) ;
sub get_section {
    my ($self, $name) = @_;

    exists $Section->{ $name }
        ? $Section->{ $name }
        : undef
        ;
}

# my $bool = $section->is_mandatory_field($field_index);
sub is_mandatory_field {
    my ($self, $field_index) = @_;

    # Consult Specific muffin variable <section>[i].mandatory
    $self->get_muffin_variable( sprintf("%s[%d].mandatory", $self->name(), $field_index + 1) )->[0];
}

# my $bool = $section->is_template_field($field_index);
sub is_template_field {
    my ($self, $field_index) = @_;

    # Consult specific muffin variable <section>[i].template
    $self->get_muffin_variable( sprintf("%s[%d].template", $self->name(), $field_index + 1) )->[0];
}

#============================================================================
#
# TEMPLATE-BASED RECORDS GENERATION
#
#============================================================================
# my $bool = $section->need_eval( $field_index );
sub need_eval { return 0 }

# my $bool = $section->resolve_lazy( $field_index );
sub resolve_lazy { return 1 }

# my $bool = $section->resolve_iterator( $field_index );
sub resolve_iterator { return 1 }

# $n = $section->generate_records($row);
sub generate_records {
    my ($self, $row) = @_;
    tracein(ref($self), $row);

    my ( $record, 
         $field_index, 
         $field_value, 
         $lazy_sub,
         $record_isa_template,
         @tmplflags,
    );

    my @headers = $self->headers();

    ##
    # PHASE I Evaluation (cell strings -> field values)
    $field_index = 0;
    my @record_template 
        = map { 
                # Reset $(FN) -- Field Number
                $self->set_IFN($field_index);

                # Compute field value
                $field_value = $self->compute_field_value($field_index, $_);

                # Hook
                $field_value = $self->validate_cell($field_index, $headers[$field_index], $field_value);

                # Set MuffinMC auto-variables 
                $self->set_muffin_recordfield_variables($field_index, $field_value);

                # Check template generation status
                # Field must be 'template enabled'
                # and must bear more than one value
                $tmplflags[@tmplflags] = $self->is_template_field($field_index);
                $record_isa_template ||= $tmplflags[-1] && @$field_value > 1;

                # Don't forget that ;)
                $field_index++;

                # map value
                $field_value;
          } @$row;

    # 2. Generate final records from record template
    my $nb_generated_records = 0;     # Number of final generated records for this row

    my @final_records 
        = $record_isa_template
          ? $self->template_based_cross_product_generation(\@tmplflags, @record_template) 
          : ( [@record_template] )
          ;
    
    ##
    # PHASE II Evaluation :: Resolve late values (lazy) & iterators
    #
    # Tag records in their 1st field as followed :
    #   - 0     => regular records
    #   - 1     => 1st  of a declination serie
    #   - 2     => 2nds in a declination serie
    if (@final_records) {
        if (@final_records == 1) {
            $final_records[0][0] = [ 0 ];
        }
        else {
            $final_records[0][0] = [ 1 ];
            for (my $i = 1; $i < @final_records; $i++) {
                $final_records[$i][0] = [ 2 ];
            }
        }
    }
    trace("PHASE II GENERATION : ", scalar( @final_records ) . " final records", @final_records );
    foreach $record ( @final_records ) {
        for ($field_index = 0; $field_index < @$record; $field_index++) {

            # Reset $(FN) -- Field Number
            $self->set_IFN($field_index);

            # Compute Lazy value or Iterator sequence next value
            if ( 
                 ( $lazy_sub = Franckys::MuffinMC::muffin_isa_lazy( $record->[$field_index] ) )
                 && $self->resolve_lazy($field_index)
            ) {
                #$record->[$field_index] = [ sprintf('PHASE-II-LAZY::%s. Section(%s) RN(%d)', $lazy_sub, $self->name(), $self->nb_records() + 1) ];
                $record->[$field_index] = $lazy_sub->($self, $record, $field_index);
                trace("## Lazy_field index:[$field_index] --> ", $record->[$field_index]);
            }
            elsif (
                    ( $lazy_sub = Franckys::MuffinMC::muffin_isa_iterator( $record->[$field_index] ) )
                    && $self->resolve_iterator($field_index)
            ) {
                #$record->[$field_index] = [ sprintf('PHASE-II-IT::%s. Section(%s) RN(%d)', $lazy_sub, $self->name(), $self->nb_records() + 1) ];
                $record->[$field_index] = $lazy_sub->(1, $self, $record, $field_index);
                trace("## IT_field index:[$field_index] --> ", $record->[$field_index]);
            }

            # Hook
            $record->[$field_index] = $self->validate_cell($field_index, $headers[$field_index], $record->[$field_index]);

            # Set MuffinMC final auto-variables 
            $self->set_muffin_recordfield_variables($field_index, $record->[$field_index]);
        }

        # Store final record datas
        if ( $record = $self->validate_record($record) ) {

            # Set MuffinMC variable : <Section>[RN + 1] <- $record
            $self->set_muffin_record_variable( $record );

            $self->add_record($record);

            $nb_generated_records++;
        }
    }

    # Number of final records generated
    traceout( $nb_generated_records );
    $nb_generated_records;
}

# my @final_records = $section->template_based_cross_product_generation($record_field, ...);
#
# Generates as many final individual records as necessary, based on the 
# number of values of multi-dimensional fields.
#
# The number of arguments sets the arity of the final records, to be seen as
# valued-vectors.
sub template_based_cross_product_generation {
    my ($self, $tmplflags_ar, @fields) = @_;
    tracein(ref($self), @fields);

    my @records;

    if ( @fields == 0) {
        @records = ( [] );
    }
    else {
        my $field    = shift @fields;
        my $tmplflag = shift @$tmplflags_ar;

        @records = $self->template_based_cross_product_generation($tmplflags_ar, @fields);

        if ( (@$field  > 1) && $tmplflag ) {
            @records
                = map {
                      my $field_value = $_;
                      map { 
                          my $record = $_;
                          my $record_clone  = [ @$record ];
                          unshift @$record_clone, [ $field_value ];
                          $record_clone;
                      } @records
                  } @$field;
        }
        else {
            unshift @$_, [ @$field ]  foreach @records;
        }
    }

    traceout( @records );
    return @records;
}

# my undef | $record =  $section->validate_record($record);
#
# Can return 0, 1 or more FINAL records to be added
sub validate_record {
    return $_[1];
}

# (void) $section->validate_cell(index, header, value)
#
# Can return 0, 1 or more FINAL records to be added
sub validate_cell {
    return $_[3];
}

# my $final = $section->sub compute_field_value( $field_index, $cell_string);
sub compute_field_value {
    my ($self, $field_index, $cell_string) = @_;
    tracein(ref($self), $field_index,$cell_string);

    # Normalize string
    $self->chomp_spaces( $cell_string );

    # Check field value status
    my $field_value;
    if ( $self->is_field_empty($cell_string) ) {
        if ( $self->is_mandatory_field($field_index) ) {
            if ( my $field_default_value
                    = $self->get_field_default_value( $field_index )
            ) {
                # Access <Section>.<Field>.Default
                if ( ref( $field_default_value ) eq 'ARRAY' ) {
                    # FINAL VALUE [...]
                    $field_value = $field_default_value;
                }
                else {
                    # ALIAS VALUE (a literal string
                    # that substitutes to the empty cell_string)
                    $cell_string = $field_default_value;
                }
            }
            else {
                # Record semantic error
                $field_value
                    = [ 
                        $self->set_error(
                            'DATA_MISSING',
                            $self->headers( $field_index ),
                        )->as_string()
                    ];
            }
        }
        else {
            $field_value = [];
        }
    }

    ## At this stage, $field_value is set only after reaching a final default value or an error.
    ## And that should be it.
    ## Not set if muffin expression not evaluated yes
    
    # Compute Muffin Expression or not...
    if (! defined $field_value) {
        $field_value
            = $self->need_eval( $field_index )
                ? $self->EVAL( $field_index, $cell_string )
                : [ $cell_string ]
    }

    traceout($field_value);
    return $field_value;
}

# my $final = $section->EVAL( $field_index , $cell_string );
# 
# An array reference on a list of values, possibly reduced
# to a simple singleton.
sub EVAL {
    my ($self, $field_index, $cell_string) = @_;
    tracein(ref($self), $field_index, $cell_string);

    my $v = muffin_eval( $cell_string, $self );

    traceout($v);
    return $v;
}

# my $field_default_value | undef = $section->get_field_default_value( $field_index );
sub get_field_default_value {
    my ($self, $field_index) = @_;
    tracein(ref($self), $field_index);

    # <Section>.<Field>.Default
    my $field_default_varname
        = sprintf('%s.%s.Default',
                    $self->name(),
                    $self->headers( $field_index ),
    );

    my $default = $self->exists_muffin_variable($field_default_varname)
        ? $self->get_muffin_variable($field_default_varname)
        : undef;    # No default value

    traceout( $default );
    return $default;
}

# my @field_values = $section->get_record_final_value( $record, $field_index );
sub get_record_final_value {
    my ($self, $record, $field_index) = @_;
    return $record->[$field_index];
}

# $section->chomp_spaces( $str );
sub chomp_spaces {
    $_[1] =~ s|$Regex{leading_spaces}||;
    $_[1] =~ s|$Regex{trailing_spaces}||;
}

# $bool = $self->is_field_empty( $field ) ;
sub is_field_empty {
    return $_[1] =~ /$Regex{empty_field}/;
}


#============================================================================
#
# Interface with MuffinMC
#
#============================================================================
##
# $section = $section->set_muffin_headerfield_variables(
#       $section_name,
#       $section_header_name,
#       $field_index,
#       $is_mandatory_flag,
#       $is_template_flag,
# )
#
# Sets the following MuffinMC variables
#
#   <Section>[i].header          = header  (index starts at 1)
#   <Section>.<Header>.index     = index   (starts at 1; iff header name not blank)
#
#   <Section>.<Header>.mandatory = 0/1     (iff header name not blank)
#   <Section>[i].mandatory       = 0/1     (index starts at 1)
#
#   <Section>.<Header>.template  = 0/1     (iff header name not blank)
#   <Section>[i].template        = 0/1     (index starts at 1)
#
sub set_muffin_headerfield_variables {
    my (    $self,
            $section_name,
            $section_header_name,
            $field_index,
            $is_mandatory_flag,
            $is_template_flag,
     ) = @_;

    $field_index++;    # Starts at 1 externally (within MuffinMC)

    #  "<Section>[i]"
    my $section_i = sprintf('%s[%d]', $section_name, $field_index);

    # <Section>[i].header          = header  (index starts at 1)
    # <Section>[i].mandatory       = 0/1     (index starts at 1)
    # <Section>[i].template        = 0/1     (index starts at 1)
    $self->set_muffin_variable( "${section_i}.header",    [ $section_header_name ] );
    $self->set_muffin_variable( "${section_i}.mandatory", [ $is_mandatory_flag   ] );
    $self->set_muffin_variable( "${section_i}.template",  [ $is_template_flag    ] );
    
    if ( $section_header_name ) {
        # <Section>.<Header>
        my $section_header = sprintf('%s.%s', $section_name, $section_header_name);

        # <Section>.<Header>.index     = index   (starts at 1; iff header name not blank)
        # <Section>.<Header>.mandatory = 0/1     (iff header name not blank)
        # <Section>.<Header>.template  = 0/1     (iff header name not blank)
        $self->set_muffin_variable( "${section_header}.index",     [ $field_index       ] );
        $self->set_muffin_variable( "${section_header}.mandatory", [ $is_mandatory_flag ] );
        $self->set_muffin_variable( "${section_header}.template",  [ $is_template_flag  ] );
    }

    #
    $self;
}

##
# $field_value = $section->set_muffin_recordfield_variables( $field_index, $field_value );
#
# Sets the following MuffinMC variables
#
#   <Section>[RN + 1].<Header> = $field_value  (iff Header exists for #   this column)
#   <Section>[RN + 1][FN + 1]  = $field_value  (Indices start at 1  externally)
#
sub set_muffin_recordfield_variables {
    my ($self, $field_index, $field_value) = @_;

    # Normalization 
    # /!\ Remember that indexes start at one externally, this the "+1" for RN and
    #     field_index internal values that start at 0 
    my $RN           = $self->nb_records();
    $field_value   ||= [];
    my $section_name = $self->name();

    # <Section>[RN + 1][FN + 1] = $value
    $self->set_muffin_variable(
        sprintf( '%s[%d][%d]',
                 $section_name,
                 $RN + 1,
                 $field_index + 1,
        ),
        $field_value,
    );
    
    # <Section>[RN].<FieldName>  = $value
    my ($field_name) = $self->headers( $field_index );
    $self->set_muffin_variable(
        sprintf( '%s[%d].%s',
                 $section_name,
                 $RN + 1,
                 $field_name,
        ),
        $field_value,
    ) if $field_name;

    #
    $field_value;
}

##
# $record =  $section->set_muffin_record_variable( $record );
#
# Sets the following MuffinMC variables
#   <Section>[RN + 1] <- $record
#
sub set_muffin_record_variable {
    my ($self, $record) = @_;
    tracein(ref($self), $self->nb_records() + 1, $record);

    # <Section>[RN + 1] <- $record
    $self->set_muffin_variable(
        sprintf( '%s[%d]',
                 $self->name(),
                 $self->nb_records() + 1,
        ),
        $record,
    );
    traceout();
}

# my $value = $section->set_muffin_variable($varname, $value);
sub set_muffin_variable {
    my ($self, $varname, $value) = @_;
    return muffin_setvar($varname, $value);
}

# my values_ar = $section->get_muffin_variable($varname, $param...);
sub get_muffin_variable {
    my ($self, $varname, @params) = @_;
    return muffin_getval($varname, $self, @params);
}

# my  $bool = $section->exists_muffin_variable($varname);
sub exists_muffin_variable {
    my ($self, $varname, @params) = @_;
    muffin_exists_var($varname);
}

# Specialized accessors
{
    # FN counts at 1, IFN counts at 0, whence FN = IFN + 1
    my $IFN = 0;    

    sub set_IFN { $IFN = $_[1] }
    sub get_IFN { $IFN         }
}


#============================================================================
#
# I/O
#
#============================================================================
# $section->dump();
sub dump {
    my $self = shift;
    my $section_name = $self->name();

    say   $self->dump_pre();
    say   $self->dump_name();
    say   $self->dump_headers();
          $self->dump_records();
    say   $self->dump_post();
}


###
# PRE DUMP
#
# $section->dump_pre();
sub dump_pre {
    my $self = shift;
    my $section_name = $self->name();

    return ();
}


###
# SECTION NAME
#
# $section->dump_name();
sub dump_name {
    my $self = shift;
    my $section_name = $self->name();

    #"\tFields: ",   $self->nb_fields();
    return sprintf("<h1>Section <i>%s</i></h1>\n", $section_name );
}


###
# SECTION HEADERS
#
# $section->dump_headers();
sub dump_headers {
    my $self = shift;
    my $section_name = $self->name();

    my @labeled_headers = grep { length > 0 } $self->headers();

    return
        sprintf("<h2>%d Champs</h2>\n", scalar(@labeled_headers) ),
        "<ul>\n",
        (
          map {
            my $is_mandatory_field
                = $self->get_muffin_variable(
                    sprintf( '%s.%s.mandatory',
                             $section_name,
                             $_,
                    )
                  )->[0];

            my $is_template_field
                = $self->get_muffin_variable(
                    sprintf( '%s.%s.template',
                             $section_name,
                             $_,
                    )
                  )->[0];

            sprintf(
                "<li>%s%s%s</li>\n",
                $_,
                $is_mandatory_field
                    ? '<b><sup>*</sup></b>'
                    : '',
                $is_template_field
                    ? '<b><sup>+</sup></b>'
                    : '',
            )

          } @labeled_headers,
        ),
        "</ul>\n"
        ;

    ###
    # VERBATIM HEADERS
    #
    # say "Verbatim headers: @{$self->headers_verbatim_row() }";

    ###
    # RAW RECORDS
    #
    # my @raw_rows        = $self->verbatim_rows(); 
    # say sprintf("\tVerbatime data rows (%d):", scalar(@raw_rows));
    # foreach my $row ( @raw_rows ) {
    #     my @row = map { "<$_>" } @$row;
    #     say sprintf("\t\t@row");
    #  }

    #my @named_headers = sort @headers[@indexes];
    #my @dup_named_headers = sort keys %{ $self->{index} };
    #say "[CMP] @named_headers";
    #say "[CMP] @dup_named_headers";
    #say "@named_headers" eq "@dup_named_headers" ? 'OK' : 'KO';
}


###
# SECTION RECORDS
#
# $section->dump_records();
sub dump_records {
    my $self = shift;
    my $section_name = $self->name();

    my @records = $self->records(); 

    #return
    #    sprintf("<h2>Enregistrements (%d)</h2>\n", scalar(@records) ),
    #    "<ol>\n",
    #    ( map { sprintf("<li>%s</li>\n", $self->record_as_html($_)) } @records ),
    #    "</ol>\n",
    #    "<br />\n",
    #    ;
    say  sprintf("<h2>Enregistrements (%d)</h2>\n", scalar(@records) ),
        "<ol>\n";

    say sprintf("<li>%s</li>\n", $self->record_as_html($_)) foreach @records;

    say "</ol>\n",
        "<br />\n",
        ;
}


###
# POST DUMP
#
# $section->dump_post();
sub dump_post {
    my $self = shift;
    my $section_name = $self->name();

    return "\n<p>DUMP POST FROM: $self\n";
    #return ();
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
# KINTPV GenerationI/O 
#----------------------------------------------------------------------------
sub to_kintpv {
    my ($self, $kintpvfd) = @_;
    return (0, "ok");
}


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

=head1 Franckys::CGM::Parser::Section

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

L<Franck PORCHER|mailto:franck.porcher@franckys.com>

=head1 LICENSE AND COPYRIGHT

Copyright (C) 2015 - Franck Porcher, Ph.D - All rights reserved

=cut
