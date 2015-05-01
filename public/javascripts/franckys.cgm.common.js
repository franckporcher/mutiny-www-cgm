/**
 * franckys.cgm.common.js -- CGM COMMON JavaScript's main & login/session program
 *
 * Entry point : start_session(), called from main HTML
 *
 * PROJECT: MUTINY Tahiti
 *
 * Copyright (C) 2015 Franck Porcher
 * Francky's Engineering <franck.porcher@franckys.com>
 * All rights reserved
 */


var CGM;
CGM = ( function($) {

    var self = {
        gui:    {
            // loadingWidget:  $('#cgm-loading-widget'),
            // cgmLoginScreen: $('#cgm-session')
        },

        session:    {
            status: 0
        },

        session_service:  function(url, data, cb_success, cb_error, cb_complete) {
            // Start loading widget
            CGM.gui.loadingWidget.show();

            // Add the session object
            data.session = CGM.get_session();

            $.ajax({
                type:           "POST",
                url:            url,
                async:          false,      // 1 request at a time...
                timeout:        5000,
                contentType:    'application/json',
                processData:    false,
                dataType:       'json',
                data:           JSON.stringify(data),
                cache:          false,

                success:        function(res, status, xhr) {
                    // Update local data
                    CGM.set_localdata( res.localdata );

                    // Check session
                    if ( CGM.valid_session(res.session) ) {
                        CGM.set_session( res.session );

                        // Custom function
                        if ( cb_success ) {
                            return cb_success.call(null, res, status, xhr);
                        }
                    }
                },

                error:          function(xhr, status, err_msg) { // status in: (error -> http-error; timeout ; parserror -> result parseerror 
                    CGM.set_flash(status + (err_msg ? (': ' + err_msg) : ''), 'err');

                    // Custom function
                    if ( cb_error ) {
                        return cb_error.call(null, xhr, status, err_msg);
                    }
                },

                complete:       function(xhr, status) { // status in  success or error
                    // Stop loading widget
                    CGM.gui.loadingWidget.hide();

                    // Custom function
                    if ( cb_complete ) {
                        return cb_complete.call(null, xhr, status);
                    }
                }
            });
        },

        start:  function($) {
            // Initialize widgets
            CGM.gui.loadingWidget   = $('#cgm-loading-widget');
            CGM.gui.cgmLoginScreen  = $('#cgm-session');

            // Initialize event handlers
            $('#cgm-header-close-session-button').click( CGM.close_session );
            $('#cgm-login-form').submit( CGM.login );

            // Start the application
            if ( CGM.valid_session( CGM.session ) ) {
                CGM.start_app($, CGM);
            }
            else {
                CGM.login_screen();
            }
        },

        login_screen:   function() {
            CGM.gui.cgmLoginScreen.show();   // Display the session screen with the login form that calls CGM.login()
        },

        login:  function(event) {
            event.preventDefault();

            var $form = $(this) ;

            CGM.session_service(
                $form.attr('action'),
                {
                    username:   $form.find( 'input[name="username"]' ).val(),
                    password:   $form.find( 'input[name="password"]' ).val()
                },
                function(res, status, xhr) { return CGM.start_session(res.init) }
            );
        },

        reset_session:   function () {
            CGM.set_user( 'Please log in' );
            return CGM.session = {
                status: 0
            };
        },

        get_session:   function () {
            return CGM.session;
        },

        set_session:   function (session) {
            CGM.session = session;
            CGM.set_user( session.user );
            return CGM.session;
        },

        start_session:  function( init ) {
            CGM.gui.cgmLoginScreen.hide();   // Display the session screen with the login form that calls CGM.login()
            CGM.session.valid = true;
            CGM.start_app($, CGM, init);
        },

        valid_session:   function ( session ) {
            if ( session.status == 1 ) {
                return true;
            }
            else {
                CGM.reset_session();
                CGM.login_screen();
            }
        },

        close_session: function(event) {
            event.preventDefault();
            if ( CGM.valid_session(CGM.session) ) {
                CGM.session_service(
                    '/cgm/close_session',
                    {}
                )
            }
        },

        set_localdata:  function (localdata) {
            if (localdata) {
                CGM.set_time( localdata.time );

                // set flash
                CGM.set_flash(localdata.flash, localdata.flash_class);
            }
        },

        set_flash:      function (msg, msg_class) { // Msg_class in 'log', 'info', 'warm', 'err'
            msg_class = msg_class || 'log';
            $('#flash').fadeOut().attr('class', msg_class).html(msg).fadeIn();
            return true;
        },

        set_user:       function (username) {
            $('#cgm-header-session-user').html(username);
            return true;
        },

        set_time:       function (time) {
            $('#cgm-header-session-time').html(time);
            return true;
        },

        get_flash:      function () {
            return $('#flash').text();
        },

        get_flash_class: function () {  // Must return 'log', 'info', 'warn' or 'err'
            return $('#flash').attr('class');
        },

        log:            function (msg){
            return true;
        },

    }; // end self

    return self;
})( jQuery );
