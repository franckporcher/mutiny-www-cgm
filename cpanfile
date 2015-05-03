requires perl                           => '5.20.1';
requires 'Encode';
requires 'Unicode::Collate';
requires 'Unicode::Normalize';
requires 'Const::Fast';
requires 'Scalar::Util';
requires 'Data::Dumper';
requires 'Text::CSV'                    => '1.32';
requires 'local::lib'                   => '2.000015';
requires 'Perl6::Export::Attrs'         => '0.0.3';
requires 'File::Slurp';
requires 'Try::Tiny';
requires 'Template';
requires 'JSON'                         => '2.90';
requires "Dancer2"                      => "0.159003";
requires "Dancer2::Plugin::Ajax";
requires "Digest::MD5";
requires "Carp::Always";

recommends "YAML"                       => "0";
recommends "URL::Encode::XS"            => "0";
recommends "CGI::Deurl::XS"             => "0";
recommends "HTTP::Parser::XS"           => "0";

on "test" => sub {
    requires "Test::More"               => "0";
    requires "Test::Most"               => "0";
    requires "HTTP::Request::Common"    => "0";
};
