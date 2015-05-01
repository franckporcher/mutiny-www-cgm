package Franckys::CGM;
our $VERSION = '0.1';

use Dancer2;
use Dancer2::Plugin::Ajax;
use File::Spec;
use File::Slurp;
use Cwd qw/realpath/;
use Franckys::Error;
use Franckys::Trace;
use Franckys::MuffinMC;
use Digest::MD5             qw(md5_hex);
use Data::Dumper;
$Data::Dumper::Purity   = 1;
$Data::Dumper::Useqq    = 1;
$Data::Dumper::Deepcopy = 1;
$Data::Dumper::Deparse  = 1;


#--------------------------------------------------------------
# Default settings
#--------------------------------------------------------------
my %SES_SECRETS = (
    Pierre      => '2bbc4741a60d00686ad1d62772a2be2e',
    Erik        => '9c89b632c3cb766ea77b14181fcbe9b8',
    #Franck      => 'bd80c0a6b7ead1e7e233053e0b9e1fed',
    fpo         => '',
    Guest       => 'd04e332211f4c2bd0c024906a7615fd6',
);

my %SES_INDICES = (
    Pierre      => 'A()I()U()',
    Erik        => 'A()I()U()',
    Franck      => 'new(ILC)',
    Guest       => 'IL(3)Mutiny',
);

my $DEBUG   = 0;
my $APPNAME ='';
my $SESSION_MAX_INACTIVITY = 60 * 15;   # Session expires after 15' of inactivity

my $APP = {
    cgm         => {
        title               => 'Console CGM',
        layout              => 'main',
        template_main       => 'common.tt',
        template_content    => 'index.tt',
        user                => 'Please login',
        welcome             => 'Bienvenue! CGM vous souhaite une bonne p\'tite session.',
    },
    muffinmc    => {
        title               => 'Console Muffin<i>MC</i>',
        layout              => 'muffinmc',
        template_main       => 'common.tt',
        template_content    => 'muffinmc.tt',
        user                => 'Please login',
        welcome             => 'Bienvenue! Muffin<i>MC</i> vous souhaite une bonne p\'tite session.',
    },
};


#--------------------------------------------------------------
# CGM Local Data (time, flash message)
#--------------------------------------------------------------
{
    my $flash       = '';
    my $flash_class = 'info';   # log, info, warn, err

    sub set_flash {
        ($flash, $flash_class) = @_;
        $flash       = '' unless defined $flash;
        $flash_class = 'info' unless defined $flash_class;
    }

    sub get_flash {
        my $msg = $flash;
        $flash = '';
        return $msg || '';
    }

    sub get_flash_class {
        return $flash_class || 'info';
    }
}

##
# $hash_ref = local_data();
#
sub local_data {
    return {
        time        => scalar localtime,
        flash       => get_flash(),
        flash_class => get_flash_class(),
        debug       => $DEBUG,
    }
}


#--------------------------------------------------------------
# hooks
#--------------------------------------------------------------
hook before => sub {
    # var time => scalar(localtime);
    # debug to_dumper( request );
};


#--------------------------------------------------------------
# CMG home page
#--------------------------------------------------------------
# any [qw(get post)]
# post
any '/cgm' => sub {
    $APPNAME = 'cgm';
    return homepage_common();
};


#--------------------------------------------------------------
# MuffinMC home page
#--------------------------------------------------------------
get '/cgm/muffinmc' => sub {
    $APPNAME = 'muffinmc';
    return homepage_common();
};


#--------------------------------------------------------------
# COMMON SESSION LOGIN
#--------------------------------------------------------------
ajax '/cgm/login' => sub {
    my $data        = from_json( request->body, { utf8 => 1});  # Hash ref
    my $username    = $data->{username};
    my $password    = $data->{password};

    # Trace
    # my %parameters  = params;
    # debug "\n=== [LOGIN] Params: " . to_dumper(\%parameters);
    debug   "=== [/cgm/login] username/password: $username/$password";

    #
    # Create new session
    #
    my $session = create_session($username, $password);

    #
    # Session init data   
    #
    my $init;
    if ( valid_session($session) ) {
        my $sesdata = session $username;
        $init = { history => $sesdata->{history} }
            if $sesdata && (exists $sesdata->{history})
    }

    #
    # Result
    #
    my $res = {
        session     => $session,
        localdata   => local_data(),
        $init ? (init => $init) : (),
    };

    content_type 'application/json';
    my $json = to_json($res, {utf8 => 1});
    debug "=== [AJAX] Sending back to caller (json): $json\n\n";
    return $json;
};


ajax '/cgm/close_session' => sub {
    my $data        = from_json( request->body, { utf8 => 1});      # Hash ref
    my $session     = $data->{session};
    debug   "=== [/cgm/close_session] session: " . to_dumper($session);

    my $res = {
        session     => close_session($session),
        localdata   => local_data(),
    };

    content_type 'application/json';
    my $json = to_json($res, {utf8 => 1});
    debug "=== [AJAX] Sending back to caller (json): $json\n\n";
    return $json;
};


#--------------------------------------------------------------
# MuffinMC REPL Server
#--------------------------------------------------------------
ajax '/cgm/muffinmc/eval' => sub {
    my $data        = from_json( request->body, { utf8 => 1});      # a hash ref
    my $request     = $data->{request};
    my $context     = $data->{context};                             # FIX THIS: Serialized Perl, or a hash (from deserialized json)
    my $session     = $data->{session};
    my $history     = $data->{history};
    $request        = '' unless defined $request;
    $context        = {} unless defined $context;                   # FIX THIS: '' or {}
    $session        = {} unless defined $session;

    debug "\n=== [AJAX] DATA " . to_dumper($data);
    debug   "=== [/cgm/muffinmc/eval] MuffinMC request: $request";
    # debug "=== [AJAX] MuffinMC context: " . to_dumper($context);   # FIX THIS
    # debug "=== [AJAX] MuffinMC serialized context : $context";     # FIX THIS

    # 1. Settings
    my $ERROR     = Franckys::Error::Error();
    my $rewrite   = $request;
    my $explain   = [];
    my $final     = [];
    my $errors    = [];

    # 2. Check session
    $session  = check_session( $session );
    if ( valid_session($session) ){
        # 0. Update session's local storage
        record_session( $data );

        # 1. Explanation
        $explain = muffin_explain($request, $ERROR);
        unless ( $ERROR->nb_errors() == 0 ) {
            $errors = [ $ERROR->msgs() ];
            set_flash('Hmmmm... encore un petit effort ;)', 'warn');
            goto RETURN_EVAL;
        }

        # 2. Rewrite
        $rewrite = muffin_rewrite($request, $ERROR);

        # 3a. Install context FIX THIS
        # muffin_reset_vars();                                      # FIX THIS. To uncomment if context restaured from caller
        # my $context_h = eval $context;                            # IDEM
        # debug "=== [AJAX] MuffinMC restaured context: " . to_dumper($context_h);
        # while ( my($var, $val) = each %$context_h ) {
        #     muffin_setvar($var, $val);
        # }

        # 3b. Eval
        $final = muffin_eval($request, $ERROR);
        unless ( $ERROR->nb_errors() == 0 ) {
            $errors = [ $ERROR->msgs() ];
            set_flash('Hmmmm... almost there ;)', 'warn');
        }
    }

  RETURN_EVAL:
    # FIX THIS : my %context = @{ muffin_dump_vars() };
    # IDEM debug "=== [AJAX] Context out (Data::Dumper) ", Dumper([\%context],['context']);

    my $res = {
        session     => $session,
        localdata   => local_data(),

        req         => $rewrite,            # Récriture canonique
        explained   => $explain,            # [explain...]
        res         => $final,              # [val...] (for type=multiple) 
        type        => 'multiple',          # Standard final value => [val, ...]
        err         => $errors,             # [err...]
        # context   => \%context,           # FIX THIS The resulting global context as a JSON object
        # context   => 'Dumper(\%context),  # FIX THIS As a Data::Djumper serialized Perl
        context     => '',
    };

    # FIX THIS debug "=== [AJAX] Sending back to caller (perl tree): ", to_dumper($res);

    my $json = to_json($res, {utf8 => 1});
    debug "=== [AJAX] Sending back to caller (json): $json\n\n";

    content_type 'application/json';
    return $json;
};


#--------------------------------------------------------------
# CMG default page
#--------------------------------------------------------------
any qr{.*} => sub {
    status 'not_found';
    set_flash("La page demandée: " . request->path . " n'existe pas.<br/>Vous avez été redirigé sur la page d'accueil.", 'info');
    forward '/cgm';
};


#--------------------------------------------------------------
# COMMON Pages
#--------------------------------------------------------------
sub homepage_common {
    set_flash($APP->{$APPNAME}{welcome});
    return template $APP->{$APPNAME}{template_main},
            {
                app         => $APP->{$APPNAME},
                localdata   => local_data(),
            },
            {
                layout  => $APP->{$APPNAME}{layout},
            }
            ;
}


#--------------------------------------------------------------
# Sessions management
#--------------------------------------------------------------
# $session_obj = create_session($user, $password)
sub create_session {
    my ($username, $password) = @_;

    if ( $username
         &&   exists $SES_SECRETS{$username}
         &&   ( $SES_SECRETS{$username} eq '' || md5_hex($username, $password) eq $SES_SECRETS{$username})
    ) {
        # Welcome message
        set_flash("Bienvenue <i>$username</i> !");

        # Start new session
        my $time = time;
        my $session = {
            status      => 1,
            status_msg  => 'session_new',
            sessionid   => md5_hex($SES_SECRETS{$username}, request->address()),
            user        => $username,
            start       => scalar localtime($time),
            timestamp   => $time,
            last_seen   => $time,
        };

        return $session;

    }
    else {
        my $ref  = $SES_SECRETS{$username};
        my $comp = md5_hex($username, $password);
        set_flash("Utilisateur inconnu du système: <i>$username</i>", 'warn');
        return {
            status      => 0,
            status_msg  => 'unknown_user',
            user        => $username,
        },
    }
}

# $session_obj = check_session($session)
sub check_session {
    my $session = shift;
    $session = {} unless defined $session;

    my $status_msg = 'session_unknown';

    if ( exists $session->{sessionid} ) {
        if (   exists $session->{user}
            && exists $session->{start}
            && exists $session->{timestamp}
            && exists $session->{last_seen}
        ) {
            # Check that session is valid
            if ( exists $SES_SECRETS{ $session->{user} }
                 && $session->{sessionid} eq md5_hex($SES_SECRETS{ $session->{user} }, request->address())
                 && (scalar localtime($session->{timestamp})) eq $session->{start}
            ) {
                my $time = time;
                if ( $time - $session->{last_seen} > $SESSION_MAX_INACTIVITY ) {
                    $status_msg = 'session_expired';
                    goto RETURN_CHECK_SESSION;
                }
                else {
                    # Session OK
                    $session->{status}     = 1;
                    $session->{status_msg} = 'session_ok';
                    $session->{last_seen}  = $time;

                    return $session;
                }
            }
        }

        # Session tampered with !
        $status_msg = 'session_closed_by_service';
    }

  RETURN_CHECK_SESSION:
    # Invalid session
    set_flash("La session n'est plus valide : <i>$status_msg</i> !", 'warn');

    delete $session->{sessionid};

    $session->{status}      = 0;
    $session->{status_msg}  = $status_msg;

    return $session;
}

# $session_obj = close_session($session);
sub close_session {
    my ($session) = @_;

    $session = check_session($session);

    if ( valid_session($session) ) {

        my $status_msg = 'session_closed_by_user';
        set_flash("Merci de votre visite! (<i>$status_msg</i>)", 'info');

        return {
            status      => 0,
            status_msg  => $status_msg,
            user        => 'Please login',
        },
    }

    return $session;
}

# $boolean = valid_session($session)
sub valid_session {
    my $session = shift;
    $session    = {} unless defined $session;

    return $session->{status} == 1;
}

# record_session($data)
sub record_session {
    my $data = shift;
    session
        $data->{session}{user} => {
            session => $data->{session},
            history => $data->{history},
            context => $data->{context},
        };
}

# my $local_session = get_session($session)
sub get_session {
    my $session = shift;
    return session($session->{user});
}

true;

__DATA__



# ENV - HTTP PARAMS
# -----------------
# 1. Set
# 2. Retrieve
# params->{'parameter'}
# param('parameter')
# param 'parameter'
#
#
# ENV - CONFIG
# --------------
# 1. Set thru config file config.yml and environment/env.yml
# config->{'prop'} = value;
#
# 2. Retrieve
# my $prop = config->{'prop'};
#
# Exemple : switch or load a different env :
# config->{environment}='myenv';
# Dancer2::Config::load();
#
#
# ENV - SETTINGS
# --------------
# 1. Set
# set 'property'    => value;
# set 'layout'      => other layout
#
# 2. Retrieve
# my $prop = setting('prop');
#
#
# ENV - VARS
# --------------
# 1. Set
# var time     => scalar(localtime);
# vars->{time} =  scalar(localtime);
#
# 2. Retrieve
# [% vars.time %>
# vars->{time};
# OR
# var 'time';
#
#
# ENV - SESSIONS
# --------------
# 1a. Set session in the code
# set session => 'YAML';
#
# 1b. Set session thru config file
# session: YAML
# engines:
#    session:
#       YAML:
#          session_dir: /tmp/dancer-sessions
#
# session: YAML
# engines:
#    session:
#       YAML:
#          session_dir: /tmp/dancer-sessions
#
# 2. Populate session
# session varname => $value;
#
# 3. Retrive session value
# session('varname')
#   OR
# session->read('varname');
#
# 4. Destroying a session
# app->destroy_session;
#
#
#
# OTHER METHODS
# -------------
# my $file_content = read_file(filename);
# uri_for('/path');
#
# request->method() => post | get | ...
#
# return redirect 'other_path'
#
# Serving static file
# -------------------
#   return send_file 'file.html', instead of template()...
#
#
# Factoring commun template data
# --- --------------------------
# hook before_template_render => sub {
#     my $tokens = shift;
#     $tokens->{'css_url'} = request->base . 'css/style.css';
#     $tokens->{'login_url'} = uri_for('/login');
#     $tokens->{'logout_url'} = uri_for('/logout');
#}
#
#
# Capturing par of the URL path
# ------------------------------
# get '/my/site/:page' => sub {
#   my $page = params->{page};
#   ...
# }
#
#
# Wildcard path matching and splat
# --------------------------------
# You can also declare wildcards in a path, and retrieve the values they
# matched with the splat keyword:
#
#     get /my/*/* {
#       my ($site, $page) = splat; /!\ LIST context !!!
#       my ($site)        = splat;
#       ...
#     }
#
#
# Default route
# -------------
#     In case you want to avoid a 404 error, or handle multiple routes in the
#     same way and you don't feel like configuring all of them, you can set up
#     a default route handler.
#
#     The default route handler will handle any request that doesn't get
#     served by any other route.
#
#     All you need to do is set up the following route as the last route:
#                                                             ==========
#
#     any qr{.*} => sub {
#        status 'not_found';
#        template 'special_404', {
#           path => request->path,
#           email => '...'
#        };
#     };
#
#     Then you can set up the template as such:
#
#     You tried to reach <% path %>, but it is  unavailable at the moment.
#     Please try again or contact us at our  email at <% email %>.
#
