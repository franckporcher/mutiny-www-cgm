/**
 * franckys.cgm.muffinmc.js -- CGM MuffinConsole JavaScript's main program
 *
 * PROJECT: MUTINY Tahiti
 *
 * Copyright (C) 2015 Franck Porcher
 * Francky's Engineering <franck.porcher@franckys.com>
 * All rights reserved
 */

CGM.start_app = function($, client, init) {

    /**
     * Top Levem MuffinMC Console
     */
    if ( CGM.mc ) {
        CGM.mc.hard_reset( init );   // init: { history => [h, ..] }
    }
    else {
        CGM.mc = new Franckys_REPL({
            client:     client,         // CGM

            language: {
                name:       'MuffinMC', 
                server:     '/cgm/muffinmc/eval',
                timeout:    5000
            },

            // VIEW
            view: {
                css_class:              'MC',
                container_id:           'muffinmc-repl-container',
                repl_nblines_id:        'muffinmc-repl-nblines',
                repl_nbrequests_id:     'muffinmc-repl-nbrequests',
                reset_button_id:        'muffinmc_reset_repl',
                selection_button_id:    'muffinmc_get_repl_selection',
                input_widget_id:        'muffinmc-repl-input',
                clear_input_widget_id:  'muffinmc-clear-input',
                demo_widget_id:         'muffinmc-demo',
            },
        }, init);
    }

    var req1 = {
        req:        '=(x 1 2 #(map + 3 4 5) 6 7 "hello world")',
        explained:  [],
        res:        [ 1, 2, 12, 6, 7, "hello world" ],
        err:        [ "Beware the wolfies", "... do not worry all is ok", "For sure!" ],
    };

    var req2 = {
        req: '=(ascii-art-1 \'( =(* x   #(2- $(_1)) I   I(*($(x)" ")N) foo \'( #(. #(I $(x))))) #(say ?(#(== $(_1) 1) N "N#(map foo #(.. 1 $(_1)))N"))',
        explained:  [],
        res:        [ "ascii-art-1" ],
        err:        [], 
    };
};

