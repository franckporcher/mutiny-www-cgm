/**
 * franckys.replconsole.js -- A Generic Console for a REPL language
 *
 * PROJECT: MUTINY Tahiti
 *
 * Copyright (C) 2015 Franck Porcher
 * Francky's Engineering <franck.porcher@franckys.com>
 * All rights reserved
 */

/**
*=========================================================
* CONSTRUCTOR
*=========================================================
* 
* var repl = new Franckys_REPL ( initializer ) ;
*
* initializer = {
*   client: client Object
*       must answer the methods: set_flash(msg [, class]),  class=log, info, warn, err
*                                get_flash(msg), 
*                                get_flash_class(),     => log, info, warn, err
*                                set_time,
*                                log(msg)
*
*   language: {
*       name:   'MuffinMC'
*   },
*
*   // VIEW
*   view: {
*       css_class:              'MC',
*       container_id:           'muffinmc-repl-container',
*       reset_button_id:        'muffinmc_reset_repl',
*       selection_button_id:    'muffinmc_get_repl_selection',
*       repl_nblines_id:        'muffinmc-repl-nblines',
*       repl_nbrequests_id:     'muffinmc-repl-nbrequests',
*       input_widget_id:        'muffinmc-repl-input'
*       clear_input_widget_id:  'muffinmc-clear-input',
*       demo_widget_id:         'muffinmc-demo',
*
*   }
* }
*
*=========================================================
* VIEW
*=========================================================
* 
* THE USER MUST PROVIDE THE FOLLOWING : 
*   [HTML]
*   . An html container and its id
*     Exemple:  'muffinmc-repl-container'
*
*   . The following widget-object-ids
*       - reset-button-id     
*           ID of a user-defined button that, when defined,
*           will be automatically associated by REPL to a
*           REPL hook so when this button gets clicked, the REPL
*           will reset.
*
*       - selection-button-id
*           Id of an user provided button that will be made clickable by REPL
*           when some REPL lines are selected, and conversely.
*           /!\ The click action, though, will be user defined, to
*           fetch the REPL selection and decide what to do with it.
*
*       - repl-nblines-id
*           Id of an user-defined text-zone that REPL will use to update
*           the number of lines in the REPL
*
*       - repl-nbrequests-id
*           Id of an user-defined text-zone that REPL will use to update
*           the number of requests made from the REPL.
*
*   - [CSS] The name and definition of the REPL main CSS class
*     that will be used transparently by the REPL's view controler
*
*     Exemple: 'MC'
*
* REPL WILL USE THE FOLLOWING CSS CLASSES
*  .MC                        (main CSS class, to be provided)
*  .MC.line                   (pour chaque ligne <tr>...</tr> affichée dans la console
*  .MC.blob-num               (<td> numéro de la ligne</td>)
*  [ MC.blob-type-<xxx> ]      TYPE DE LA LIGNE
*      .MC.blob-type-code     (<td> pour signifier type de la ligne = CODE</td>)
*      .MC.blob-type-res      (<td> pour signifier type de la ligne = RESULTAT</td>)
*      .MC.blob-type-err      (<td> pour signifier type de la ligne = ERREUR</td>)
*  [ MC.blob-line-code ]       DATA DE LA LIGNE
*      .MC.blob-line-code     (<td> CODE </td>)
*      .MC.blob-line-res      (<td> RESULTAT </td>)
*      .MC.blob-line-err      (<td> ERR </td>)
*   .MC.blob-space            (<td spacer></td>)
*   .MC.blob-footer
*
*  [ MC-tt... ]                CSS CLasses for rendering/colorizing language statements in the REPL
*   .SC
*   .MC.SC.tt-<tokentype>-start
*   .MC.SC.tt-<tokentype>-value
*   .MC.SC.tt-<tokentype>-end
*
*
* REPL VIEW's CONTROLER will transparently build and maintain
* in sync the following view: 
*
* <div id="muffinmc-repl-container">
*     <table   id="muffinmc-repl-table"   class="MC">
*       <tbody id="muffinmc-repl-tbody"   class="MC">
*             <tr id="000001_code_1"  class="B000001 MC line"  >
*                 <td                 class="MC blob-num">1</td>
*                 <td                 class="MC blob-type-code"></td>
*                 <td                 class="MC blob-line-code">
*                     use strict;
*                 </td>
*                 <td                 class="MC blob-space"></td>
*             </tr>
*
*             <tr id="000001_res_1"  class="B000001 MC line">
*                 <td                 class="MC blob-num">2</td>
*                 <td                 class="MC blob-type-code"></td>
*                 <td                 class="MC blob-line-code">
*                     Result 1
*                 </td>
*                 <td                 class="MC blob-space"></td>
*             </tr>
*
*             <tr id="000001_res_2"   class="B000001 MC line">
*                 <td                 class="MC blob-num">3</td>
*                 <td                 class="MC blob-type-code"></td>
*                 <td                 class="MC blob-line-code">
*                     Result 2
*                 </td>
*                 <td                 class="MC blob-space"></td>
*             </tr>
*         </tbody>
*     </table>
* </div>
*
* The CSS id of each REPL line is built as :
*
*   <MAIN_CLASS>_<numero_unique_de_la_requete>_<type_de_la_ligne:{ C)code | R(esultat | E(err }_<numero_occurence_dela_ligne_dans_le_type>
*   Exemple :
*       MC_1_code_1:   requete 1 : ligne code 1
*       MC_2_res_1:    requete 2 : ligne resultat 1
*       MC_2_res_2:    requete 2 : ligne resultat 2
*       MC_3_err_1:    requete 3 : ligne erreur 1
*       MC_3_err_2:    requete 3 : ligne erreur 2
*
*
*=========================================================
* REQUEST OBJECT
*=========================================================
*
* request_response = {
*   req         'STRING: language statement (as submitted from the console)',
*   type        multiple | matrix
*   explained:  [] 
*               [ LIST of structured language-OBJECT ]
*                       structured-object:: {
*                           tt_type:    string
*                           tt_start:   string
*                           tt_stop:    string
*                           tt_value:   tt_type = 'literal'
*                                       ? string
*                                       : recurse( list of structured objects )
*                                       ,
*                           tt_depth:   niveau d'imbrication : commence à 0
*                       }
*                   ],
*   res:        [ pp_res... ],
*   err:        [ pp_err...],
*   context:    { # New vars created by this request
*               varname:  STRING: jsonified_final_value,
*               ...
*   },
*
*   # ADDED by REPL CONSOLE
*   req_id: "000019",
*   req_num: 19,
* }
*
* -------------------------------                                      
* Structured Object
* For syntax colorization
* -------------------------------
* EXEMPLE 1: "1 L(a "$(foo)" b) 2"                                      
#
#   [
#     {
#       tt_depth => 0,
#       tt_start => '"',
#       tt_stop => '"',
#       tt_type => 'string',
#       tt_value => [
#         {
#           tt_depth => 1,
#           tt_start => '',
#           tt_stop => '',
#           tt_type => 'literal',
#           tt_value => '1'
#         },
#         {
#           tt_depth => 1,
#           tt_start => 'L(',
#           tt_stop => ')',
#           tt_type => 'deflist',
#           tt_value => [
#             {
#               tt_depth => 2,
#               tt_start => '',
#               tt_stop => '',
#               tt_type => 'literal',
#               tt_value => 'a'
#             },
#             {
#               tt_depth => 2,
#               tt_start => '"',
#               tt_stop => '"',
#               tt_type => 'string',
#               tt_value => [
#                 {
#                   tt_depth => 3,
#                   tt_start => '$(',
#                   tt_stop => ')',
#                   tt_type => 'getval',
#                   tt_value => [
#                     {
#                       tt_depth => 4,
#                       tt_start => '',
#                       tt_stop => '',
#                       tt_type => 'literal',
#                       tt_value => 'foo'
#                     }
#                   ]
#                 }
#               ]
#             },
#             {
#               tt_depth => 2,
#               tt_start => '',
#               tt_stop => '',
#               tt_type => 'literal',
#               tt_value => 'b'
#             }
#           ]
#         },
#         {
#           tt_depth => 1,
#           tt_start => '',
#           tt_stop => '',
#           tt_type => 'literal',
#           tt_value => '2'
#         }
#       ]
#     }
#   ]
# 
*
* EXEMPLE 2: 
*      =(fact '( ?( #(le $(_1) 1)
*                  1
*                  #(* $(_1)
*                      #(self #(1- $(_1)))))
*             )
*       )
*
# 
#   [
#     {
#       tt_depth => 0,
#       tt_start => '=(',
#       tt_stop => ')',
#       tt_type => 'defvar',
#       tt_value => [
#         {
#           tt_depth => 1,
#           tt_start => '',
#           tt_stop => '',
#           tt_type => 'literal',
#           tt_value => 'fact'
#         },
#         {
#           tt_depth => 1,
#           tt_start => '\'(',
#           tt_stop => ')',
#           tt_type => 'quote',
#           tt_value => [
#             {
#               tt_depth => 2,
#               tt_start => '?(',
#               tt_stop => ')',
#               tt_type => 'cond',
#               tt_value => [
#                 {
#                   tt_depth => 3,
#                   tt_start => '#(',
#                   tt_stop => ')',
#                   tt_type => 'func',
#                   tt_value => [
#                     {
#                       tt_depth => 4,
#                       tt_start => '',
#                       tt_stop => '',
#                       tt_type => 'literal',
#                       tt_value => 'le'
#                     },
#                     {
#                       tt_depth => 4,
#                       tt_start => '$(',
#                       tt_stop => ')',
#                       tt_type => 'getval',
#                       tt_value => [
#                         {
#                           tt_depth => 5,
#                           tt_start => '',
#                           tt_stop => '',
#                           tt_type => 'literal',
#                           tt_value => '_1'
#                         }
#                       ]
#                     },
#                     {
#                       tt_depth => 4,
#                       tt_start => '',
#                       tt_stop => '',
#                       tt_type => 'literal',
#                       tt_value => '1'
#                     }
#                   ]
#                 },
#                 {
#                   tt_depth => 3,
#                   tt_start => '',
#                   tt_stop => '',
#                   tt_type => 'literal',
#                   tt_value => '1'
#                 },
#                 {
#                   tt_depth => 3,
#                   tt_start => '#(',
#                   tt_stop => ')',
#                   tt_type => 'func',
#                   tt_value => [
#                     {
#                       tt_depth => 4,
#                       tt_start => '',
#                       tt_stop => '',
#                       tt_type => 'literal',
#                       tt_value => '*'
#                     },
#                     {
#                       tt_depth => 4,
#                       tt_start => '$(',
#                       tt_stop => ')',
#                       tt_type => 'getval',
#                       tt_value => [
#                         {
#                           tt_depth => 5,
#                           tt_start => '',
#                           tt_stop => '',
#                           tt_type => 'literal',
#                           tt_value => '_1'
#                         }
#                       ]
#                     },
#                     {
#                       tt_depth => 4,
#                       tt_start => '#(',
#                       tt_stop => ')',
#                       tt_type => 'func',
#                       tt_value => [
#                         {
#                           tt_depth => 5,
#                           tt_start => '',
#                           tt_stop => '',
#                           tt_type => 'literal',
#                           tt_value => 'self'
#                         },
#                         {
#                           tt_depth => 5,
#                           tt_start => '#(',
#                           tt_stop => ')',
#                           tt_type => 'func',
#                           tt_value => [
#                             {
#                               tt_depth => 6,
#                               tt_start => '',
#                               tt_stop => '',
#                               tt_type => 'literal',
#                               tt_value => '1-'
#                             },
#                             {
#                               tt_depth => 6,
#                               tt_start => '$(',
#                               tt_stop => ')',
#                               tt_type => 'getval',
#                               tt_value => [
#                                 {
#                                   tt_depth => 7,
#                                   tt_start => '',
#                                   tt_stop => '',
#                                   tt_type => 'literal',
#                                   tt_value => '_1'
#                                 }
#                               ]
#                             }
#                           ]
#                         }
#                       ]
#                     }
#                   ]
#                 }
#               ]
#             }
#           ]
#         }
#       ]
#     }
#   ]
# 
*
*
* EXEMPLE 3: 
*/

/**
 ** Our Global object
 **/
var Franckys_REPL;

Franckys_REPL = ( function($) {
    "use strict";


    /**
     * ---------------------------------
     * CONSTRUCTOR
     * ---------------------------------
     *
     * this = {
     *   language: {
     *      name:       'MuffinMC',
     *      server:     '/cgm/muffinmc/eval',
     *      timeout:    5000
     *
     *      ADDED by REPL:
     *      _name:      'muffinmc'  => name in smallcaps and non alpha suppressed
     *   },
     *
     *   // VIEW
     *   view: {
     *      // Initial
     *      css_class:              'MC',
     *      container_id:           'muffinmc-repl-container',  <== MANTORY. Lots of things will break if not provided
     *      reset_button_id:        'muffinmc_reset_repl',
     *      selection_button_id:    'muffinmc_get_repl_selection',
     *      repl_nblines_id:        'muffinmc-repl-nblines',
     *      repl_nbrequests_id:     'muffinmc-repl-nbrequests',
     *      input_widget_id:        'muffinmc-repl-input,
     *      clear_input_widget_id:  'muffinmc-clear-input',
     *      demo_widget_id:         'muffinmc-demo',
     *
     *      // Added by REPL
     *      container_jq:           jQuery object for: 'muffinmc-repl-container'
     *
     *      repl_table_id:          <language.name>-repl-table
     *      repl_table_jq:          the jQuery table object
     *      repl_tbody_id:          <language.name>-repl-tbody
     *      repl_tbody_jq:          the associated jQuery object
     *
     *      repl_nblines_jq:        jQuery object for node: #muffinmc-repl-nblines',
     *      repl_nbrequests_jq:     jQuery object for node: #muffinmc-repl-nbrequests',
     *
     *      reset_button_jq:        jQuery object for node: #muffinmc_reset_repl',
     *      selection_button_jq:    jQuery object for node: #muffinmc_get_repl_selection',
     *
     *      input_widget_jq:        jQuery object for node: #muffinmc-repl-input
     *  },
     *
     *  // Added by REPL
     *  data:   {
     *      req_pad:        "000000",
     *      req_next_id:    1,
     *      nb_req:         0,
     *      nb_lines:       0,
     *      requests_list:  [],
     *      requests:       { req_id: {req: requete, explained:..., res:... , err: ...}, ... }
     *      history:        {
     *          sp: 0,
     *          stack: []
     *      }
     *  },
     *
     * }
     */
    var Constructor = function( initializer, initdata ) {
        //alert('[INITIALIZER] ' + franckys_dump(initializer) );
        // Shallow cloning of initializer to "this".
        var repl = this;    

        for (var property in initializer) {
            this[property] = initializer[property];
        }

        /**
         ** MAKE & SYNC THE VIEW
         **/
        // 1. Add the 'view.language property,
        //    derived from the normalized this.language.name .
        var langname = (this.language.name || 'DUMMY').replace( /[^\w]+/, "" );
        
        // 2. Add the 'view.repl_table_id' and 'view.repl_tbody_id' properties
        this.language["_name"]  = langname = langname.toLowerCase();
        this.view.repl_table_id = langname + "-repl-table";
        this.view.repl_tbody_id = langname + "-repl-tbody";

        // 3. Initialize the <table><tbody>...</table> container
        var table_html = this.ssprintf(
                '<table id="{0}" class="{1}"><tbody id="{2}" class="{1}"></tbody></table>',
                this.view.repl_table_id,
                this.view.css_class,
                this.view.repl_tbody_id
        ),
            container_jq = $('#' + this.view.container_id );
        container_jq.append( table_html );
        this.view.container_jq = container_jq;

        // 4. Memoize the jQuery objects associated with the VIEW's DOM
        // objects (changing suffix "_id" to _jq)
        var list_id_pname = [
            "repl_table_id",
            "repl_tbody_id",
            "repl_nblines_id",
            "repl_nbrequests_id",
            "reset_button_id",
            "selection_button_id",
            "input_widget_id",
            "clear_input_widget_id",
            "demo_widget_id"
        ];
       
        for ( var i = 0; i < list_id_pname.length ; i++) {
            var domid_pname = list_id_pname[i],
                domjq_pname = domid_pname.replace(/_id/, "_jq");
                
            if ( domid_pname in this.view ) {
                var jq = $('#' + this.view[domid_pname]);
                this.view[ domjq_pname ] = jq.length > 0 ? jq : null;
                //alert(domid_pname + " ---> $('#" + this.view[domid_pname] + "') --> " + this.view[ domjq_pname ]);
            }
            else {
                //alert(domid_pname + ' not currently a property of the initializer"s view. Cancelled');
                this.view[ domjq_pname ] = null;
            }
        }

        // 5. Console widgets event handlers
        if ( this.view.selection_button_jq ) {              // Paste selection to the input
            this.view.selection_button_jq.click( this.input_transfer_selection.bind(this) );
        }

        if ( this.view.reset_button_jq ) {                  // Reset the console's display panel
            this.view.reset_button_jq.click( this.console_reset.bind(this) );
        }

        var $input_widget_jq = this.view.input_widget_jq;
        $input_widget_jq.keypress(function(e) {    // Bind keyboard to Input widget
            if (e.keyCode == 13 && !e.shiftKey) {
                e.preventDefault();
                repl.input_submit();
            }
        });
        $input_widget_jq.kbdRegister( 'UP',
            function() {
                $input_widget_jq.focus();
                var h = repl.history_up();
                if ( h === null ) {
                    repl.input_reset();
                }
                else {
                    repl.input_set(h);
                }
            }
        );
        $input_widget_jq.kbdRegister( 'DOWN',
            function() {
                $input_widget_jq.focus();
                var h = repl.history_down();
                if ( h === null ) {
                    repl.input_reset();
                }
                else {
                    repl.input_set(h);
                }
            }
        );

        this.view.clear_input_widget_jq.click( this.input_reset.bind(this) );       // Clear the Console's input area
        this.view.demo_widget_jq.click( this.play_demo.bind(this, Franckys_REPL.demo) );    // Run the demo

        /**
         ** CREATE this.data
         **
         ** Requests IDs are 6-digits string-numerals padded with 0
         ** on the left.
         **/
        this.hard_reset( initdata );

        //alert('[repl.data]' + franckys_dump(this.data) );

    }; /* Constructor() */



    /*
     *---------------------------------
     * PROTOTYPE
     *---------------------------------
     */
    Constructor.prototype = {
        /**
         * Increment req uid
         *
         * -> Returns the req_uid *before* incrementation
         */
        incr_req_uid:  function( n ) {
            var n = this.data.req_next_id++;
            return n;
        },

        /**
         * Generate uniq request UID
         */
        mk_req_id:  function( n ) {
            var s   = n.toString(),
                pad = this.data.req_pad.substr(0, this.data.req_pad.length - s.length);

            return pad + s;
        },

        /*
         *---------------------------------
         * CONSOLE
         *  . console_reset()
         *  . hard_reset()
         *  . add_request()
         *  . remove_all_requests()
         *
         *  . history_add()
         *  . history_up()
         *  . history_down()
         *  . get_history()
         *
         *  . play_demo()
         *
         *  . input_reset()
         *  . input_transfer_selection()
         *  . input_submit()
         *
         *  . view_add_block()
         *  . view_remove_bloc()
         *  . view_remove_line()
         *  . view_update_header()
         *  . view_toggle_select_line()
         *  . view_toggle_fold_bloc()
         *---------------------------------
         */
        console_reset:        function () {
            /* Remove requests */
            this.remove_all_requests();
        },

        hard_reset:        function ( init ) {
            this.data = {
                // Request ID
                req_pad:        "000000",
                req_next_id:    1,
                nb_req:         0,
                nb_lines:       0,

                // Actual Requests List
                requests_list:  [
                    /* "000001", "000003", "000012", ... <= sorted by request id as
                    * a 6digits numeral string*/
                ],

                // Requests objects, by ID
                requests:   {
                    /* request_id   => request_response_object
                     * "000012"     => {
                     *       req         'STRING: language statement (as submitted from the console)',
                     *       explained:  [ LIST of structured language-OBJECT ] Voir plus haut
                     *       res:        [ pp_res... ],
                     *       err:        [ pp_err...],
                     *       context:    { varname: json, ... }      # New vars created by this request
                     *
                     *       // ADDED BY REPL
                     *       req_num: 12,
                     *       req_id:  "000012",
                     * }
                     */
                }
            }; /* this.data */

            this.history = {
                    sp:     0,
                    stack:  (init && init.history) ? init.history : []
            };

            // Clean panel
            this.view.repl_tbody_jq.empty();

            // Reset gui widgets;
            this.view_update_header();

            // Reset input widget and give it the focus
            this.input_reset();
        },

        history_add:    function(h) {
            // Avoid duplicates in the history stack
            var i;
            if ( (i = this.history.stack.indexOf(h)) > -1 ) {
               this.history.stack.splice(i,1); 
            }
            this.history.stack.unshift(h);
            this.history.sp = -1;
        },

        history_up:   function() {
            var sp = this.history.sp,
                n  = this.history.stack.length,
                h  = null;

            if ( sp < n ) sp++;
            if ( sp < n ) h = this.history.stack[sp];
            this.history.sp = sp;

            return h;
        },

        history_down: function() {
            var sp = this.history.sp,
                n  = this.history.stack.length,
                h  = null;

            if ( sp > -1) sp--;
            if ( sp < n ) h = this.history.stack[sp];
            this.history.sp = sp;

            return h;
        },

        get_history: function() {
            return this.history.stack;
        },

        play_demo:  function( demo ) {
            //alert('Launching demo:' + demo);
            if (   demo
                && demo.reqlist ) {

                //console.log(demo.reqlist);

                Franckys.promise.forEach.call(
                    this,   // repl
                    demo.reqlist,
                    function(req) {
                        return this.input_submit(req, true);
                    }
                );
            }
        },


        /**
         * ADD new request to model and update view
         * req = { 
         *       req         'STRING: language statement (as submitted from the console)',
         *       explained: [ LIST of structured language-OBJECT ] Voir plus haut
         *       res:       [ pp_res... ],
         *       err:       [ pp_err...],
         *       vars:      { varname: [ jsonvalues ], ...} # Vars created/updated by this request
         *       }
         * }
         */
        add_request:  function (req, fold_flag) {
            var req_num           = this.incr_req_uid(),
                req_id            = this.mk_req_id( req_num ),
                line_id_template  = req_id + "_{0}_{1}",            // 000017_{0}_{1}
                $container_jq     = this.view.container_jq,         // The scrollable display container.
                $tbody_jq         = this.view.repl_tbody_jq,
                //line_template     = '<tr id="{1}" class="{0} {0}-line {5}"><td class="{0} {0}-blob-num">{4}</td><td class="{0} {0}-blob-type-{2}"></td><td class="{0} {0}-blob-line-{2}">{3}</td><td class="{0} {0}-blob-space"></td></tr>';
                line_template     = '<tr id="{1}" class="{0} line {5}"><td class="{0} blob-num">{4}</td><td class="{0} blob-type-{2}"></td><td class="{0} blob-line-{2}">{3}</td><td class="{0} blob-space"></td></tr>';

            // 0. Add the ID to the request
            req.req_num = req_num;  // n
            req.req_id  = req_id;   //000n

            //alert("[add_request] " + req.req_id + ": " + franckys_dump(req));

            // 1. Add code block
            var explained = this.colorize( req.explained );
            //alert( "COLORIZE: " + explained);
            this.data.nb_lines += this.view_add_block(
                req_id,
                $tbody_jq,
                'code',
                //[ req.req ], 
                [ explained ], 
                line_id_template,
                line_template
            );

            // 2. Add results block
            this.data.nb_lines += this.view_add_block(
                req_id,
                $tbody_jq,
                'res',
                req.res,    // list
                line_id_template,
                line_template
            );

            // 3. Add error block
            this.data.nb_lines += this.view_add_block(
                req_id,
                $tbody_jq,
                'err',
                req.err,    // list
                line_id_template,
                line_template
            );

            // Stores & ranges it
            this.data.requests[ req_id ] = req;
            this.data.requests_list.push( req_id );

            // Update number of lines & number of requests
            this.data.nb_req++;
            this.view_update_header();

            // Fold the bloc corresponding to  <tr id="<REQ_ID>_code_1" class="B000001 MC MC-line">
            if ( fold_flag ) {
                this.view_toggle_fold_bloc.call(
                    $('#' + this.ssprintf( line_id_template, 'code', 1))
                );
            }

            // Scoll down the container
            $container_jq.scrollTop( $container_jq[0].scrollHeight );

            //alert('[repl.data]' + franckys_dump(this.data) );
            return true;
        },


        remove_all_requests:      function () {
            /* Remove requests */
            for ( var req_id in this.data.requests ) {
                this.view_remove_bloc(req_id, 1);
            }
            this.data.requests_list = [];

            return true;
        },


        /*
         *---------------------------------
         * COLORIZER
         *---------------------------------
         */
        // var string = colorize(tokenlist, condense_flag)
        colorize:   function (tokenlist, condense) {
            var repl = this;

            return tokenlist
                .map( function(token){ return repl.colorize_token(token)} )
                .join( condense ? '' : " " );
        },

        colorize_token: function (token) {
            var token_type      = token.tt_type,
                token_value     = token.tt_value,
                pattern         = '<span class="MC SC tt_{0} {1}">{2}</span>',
                literal_type    = '',
                string_expr;


            switch ( token_type ) {
                case 'literal':             // Scalar literal
                case 'literal_inherit':     // Scalar literal
                    string_expr = token_value;
                    break;

                case 'literal_string':      // Scalar literal
                    literal_type = token_type;
                    token_type   = 'literal';
                    string_expr  = token_value;
                    break;

                case 'literal_var':         // Scalar literal
                    literal_type = token_type;
                    token_type   = 'literal';
                    string_expr  = token_value;
                    break;

                case 'literal_func':        // Scalar literal
                    literal_type = token_type;
                    token_type   = 'literal';
                    string_expr  = token_value;
                    break;
                            
                case 'string':              // String literal
                    string_expr = this.colorize(token_value, 1);
                    break;

                default:                    // All other token
                    string_expr = this.colorize(token_value);
                    break;
            }

            return this.ssprintf(pattern, token_type, literal_type, string_expr);
        },


        /*
         *---------------------------------
         * INPUT
         *---------------------------------
         */
        input_transfer_selection:   function () {
            alert('Pasting selection !');
        },

        input_reset:   function () {
            this.view.input_widget_jq.val('');
            this.view.input_widget_jq.focus();
        },

        input_set:     function ( text ) {
            this.view.input_widget_jq.val(text);
            this.view.input_widget_jq.focus();
        },

        input_content: function () {
            return this.view.input_widget_jq.val();
        },


        input_submit:   function(text, fold_flag) {
            if ( text === undefined ) {
                text = this.input_content();
            }
            else {
                this.input_set(text);
            }
            var repl = this;
            var dfd  = $.Deferred();

            if ( text ) {
                // Protect the "\"s
                text = text.replace( /[\\]/g, "\\\\" );

                // Pass context back => Last requests's response context
                var n              = this.data.requests_list.length,
                    req_id         = (n > 0 ? this.data.requests_list[ n - 1 ] : null),
                    global_context = (req_id ? repl.data.requests[req_id].context : {} );

                CGM.session_service( // Session object is handled by 'session_service'
                    this.language.server,
                    {
                        request:    text,
                        context:    global_context,
                        history:    repl.get_history()
                    },
                    function(res, status, xhr) {
                        // Add request's normalized form to console's history
                        repl.history_add(res.req);

                        // Display results
                        switch ( res.type ) {
                            case 'matrix':      // Matrix result
                                break;
                            
                            default:            // Standard result
                                repl.add_request(res, fold_flag);
                                break;
                        }
                    },
                    null,
                    function () {
                        repl.input_reset();
                        dfd.resolve(true);
                    }
                );
            }
            else {
                dfd.resolve();
            }

            return dfd;
        },


        /*
         *---------------------------------
         * VIEW
         *---------------------------------
         */
        view_add_block: function(req_id, $container, data_type, data_list, line_id_template, line_template) {
            //alert("[view_add_block] " + franckys_dump({data_type: data_type, data_list: data_list, line_id_template:line_id_template}));
           /*
            * Build and display new line in VIEW's DOM
            *
            * <tr id="000001_code_1"          class="B000001 MC MC-line">
            *     <td                         class="MC MC-blob-num">3</td>
            *     <td                         class="MC MC-blob-type-code"></td>
            *     <td                         class="MC MC-blob-line-code">
            *         use Franckys::MuffinMC;
            *     </td>
            *     <td                         class="MC MC-blob-space"></td>
            * </tr>
            */
            var repl            = this,
                nlines          = 0,
                bloc_id         = 'B' + req_id,    // B000019 - BLOC_ID - Global id for all the lines of the block
                master_line_jq;

            data_list.forEach( function(data, i) {
                var line_id   = repl.ssprintf(
                        line_id_template,           // 000019_{0}_{1}
                        data_type,
                        i + 1
                    ),                              // ID comptés à partir de 1, non de zéro

                    // LINE
                    line_html = repl.ssprintf(
                        line_template,
                        repl.view.css_class,        // {0}  MC
                        line_id,                    // {1}  000019_code_<i+1>
                        data_type,                  // {2}  code | res | err
                        data,                       // {3}  whatever literal data...
                        repl.data.nb_lines + i + 1, // {4}  occurence dans le type, commence à 1
                        bloc_id                     // {5}  B000019
                    );

                // Add the new line to the bottom of hte container
                $container.append( line_html );

                // The DOM node associated with it
                var $line_jq      = $('#' + line_id),
                    is_first_line = data_type == 'code' && i == 0; 

                if ( data_type == 'code' && i == 0 ) {
                    $line_jq.addClass('firstline');
                }

                // Associate with it a little piece of data, for later use
                $line_jq.data({
                    repl:           repl,
                    req_id:         req_id,             // 000019
                    line_id:        line_id,            // 000019_code_i+1
                    bloc_id:        bloc_id,            // B00019
                    data_type:      data_type,          // {code, res, err}
                    data:           data,               // la data affichée sur la ligne
                    is_first_line:  is_first_line,      // flag is set only for the bloc's 1st line
                    hids:           []                  // list of jQuery.kbdRegister handlers
                });

                // Attach the new line event handlers (selection, folding, suppression)

                // Click : Fold/Unfold
                //     $line_jq.click( repl.view_toggle_select_line.bind($line_jq));                 // CLICK to select
                $line_jq.click(    repl.view_toggle_fold_bloc.bind($line_jq)     );

                // CTRL-V -> PASTE SELECTION
                var hid1 = $line_jq.kbdRegister(
                    'V',
                    repl.paste_selection.bind($line_jq),
                    [ {CTRL: true}, {META: true} ]
                );

                // DEL -> Delete request
                var hid2 = $line_jq.kbdRegister( 'DEL',   repl.view_remove_request.bind($line_jq) );

                // Keep track of registered handlers
                $line_jq.data('hids', [hid1, hid2]);

                /*
                $line_jq.dblclick( repl.paste_selection.bind($line_jq));                        // DBL-CLICK to past selection
                $line_jq.click(    repl.view_toggle_fold_bloc.bind($line_jq)  );                // CLICK to fold/unfold
                $line_jq.kbdRegister( 'DEL',   repl.view_remove_line.bind($line_jq) );          // Press DEL key to remove the line
                */

                // Keep the records up to date ;)
                nlines++;
            });

            return nlines;
        },


        view_remove_bloc:           function (req_id, dont_recompute_list) {
            var $bloc = $('.B' + req_id),
                n     = $bloc.length;

            if ( n > 0) {
                // Unregister handlers for each line (<tr>...</tr>) of the bloc
                $bloc.each(function(){
                    var hids = $(this).data('hids');
                    if (hids) {
                        hids.forEach(function(hid){ $.kbdUnregister(hid); return true; });
                    }
                    return true;
                });

                // Remove the bloc of lines
                $bloc.remove();

                // Update the modele and view
                this.data.nb_lines -= n;
                this.data.nb_req--;
                this.view_update_header();
                delete this.data.requests[ req_id ];

                // Recompute the requests list
                if (! dont_recompute_list) {
                    this.data.requests_list = $.grep(this.data.requests_list, function(x){ return x !== req_id ; });
                }
            }
            return n;
        },


        view_remove_line:       function () {
            // $(this).data() => {repl:..., req_id:..., line_id:..., data_type:..., data:... is_first_line: bool}
            // $(this).data(propertry) => value
            var $line = $(this),
                data  = $line.data();

            if ( !data.repl ) return 0;

            if ( data.is_first_line ) {
                return data.repl.view_remove_bloc( data.req_id );
            }
            else {
                $line.remove();
                data.repl.data.nb_lines--;
                data.repl.view_update_header();
                return 1;
            }
        },

        view_remove_request:       function () {
            // $(this).data() => {repl:..., req_id:..., line_id:..., data_type:..., data:... is_first_line: bool}
            // $(this).data(propertry) => value
            var $line = $(this),
                data  = $line.data();
            /*
            console.log('REMOVE: data=' + data +
                    'data.repl:' +            data.repl,
                    'data.req_id:' +          data.req_id, 
                    'data.line_id:' +         data.line_id,
                    'data.bloc_id:' +         data.bloc_id,
                    'data.data_type:' +       data.data_type,
                    'data.data:' +            data.data,
                    'data.is_first_line:' +   data.is_first_line);
            */
            return data.repl.view_remove_bloc( data.req_id );
        },


        // Paste line to input
        paste_selection:       function () {
            // $(this).data() => {repl:..., req_id:..., line_id:..., data_type:..., data:... is_first_line: bool}
            // $(this).data(propertry) => value
            var $line  = $(this),
                data   = $line.data(),
                repl   = data.repl;
            /*
            console.log('PASTE data=' + data +
                    'data.repl:' +            data.repl,
                    'data.req_id:' +          data.req_id, 
                    'data.line_id:' +         data.line_id,
                    'data.bloc_id:' +         data.bloc_id,
                    'data.data_type:' +       data.data_type,
                    'data.data:' +            data.data,
                    'data.is_first_line:' +   data.is_first_line);
            */

            repl.input_set( repl.data.requests[data.req_id].req );
        },


        view_update_header:  function () {
            var data                 = this.data,
                view                 = this.view,
                $reset_button_jq     = view.reset_button_jq,
                $selection_button_jq = view.selection_button_jq;

            view.repl_nblines_jq.html(    data.nb_lines );
            view.repl_nbrequests_jq.html( data.nb_req   );

            // Console Raz-widget
            if (data.nb_req > 0) {
                $reset_button_jq.addClass('enabled');
            }
            else {
                $reset_button_jq.removeClass('enabled');
            }

            // Console Selection-widget
            if ( $('.selected').length > 0 ) {
                $selection_button_jq.addClass('enabled');
            }
            else {
                $selection_button_jq.removeClass('enabled');
            }
        },


        view_toggle_select_line:  function (e) {
            // $(this).data() => {repl:..., req_id:..., line_id:..., data_type:..., data:... is_first_line: bool}
            // $(this).data(propertry) => value
            var $this = $(this);

            // toogle the selected line
            $this.toggleClass("selected");

            // Update the widgets
            $this.data('repl').view_update_header();
        },


        view_toggle_fold_bloc:  function (e) {
            // the line_jq is passed as the THIS object
            $('.' + $(this).data('bloc_id')).toggleClass("folded");
        },

        

        /*
         *---------------------------------
         * MISC
         *---------------------------------
         */
        /***
         * .ssprintf("string with {number} ...", var1, var2, ...)
         */
        ssprintf: function(format /*, arg...*/) {
            var args = Array.prototype.slice.call(arguments, 1);
            return format.replace(/{(\d+)}/g, function(match, number) { 
                return typeof args[number] != 'undefined'
                       ? args[number] 
                       : match;
            })
        },
    };


    /**
     * Return the constructor function here
     */
    return Constructor;

})( jQuery );

Franckys_REPL.demo = {
    reqlist:    [
        '#(say "== 1 == CREATION D\'OBJETS MUFFINMC")',
        '=( digits            0 1 2 3 4 5 6 7 8 9)',
        '=( digits-version-2  #(.. 0 9))',
        '=( hex-digits        #(.. 0 9) #(.. a f))',
        '=( 256-bytes         "$(hex-digits)$(hex-digits)")',
        '=( voyelles          a e i o u y)',
        '=( consonnes         b c d f g h j k l m n p q r s t v w x z)',
        '#(say)',
        '#(say "== 2 == RAPPEL D\'OBJETS MUFFINMC")',
        '$(digits)',
        '$(digits-version-2)',
        '$(voyelles)',
        '$(consonnes)',
        '#(say)',
        '#(say "== 3 == ACCEDER A DES VALEURS DANS UN OBJET MUFFINMC")',
        '#(say "Premiere  voyelle      --> @(voyelles 1)")',
        '#(say "Seconde   voyelle      --> @(voyelles 2)")',
        '#(say "Troisième voyelle      --> @(voyelles 3)")',
        '#(say "Quatrième voyelle      --> @(voyelles 4)")',
        '#(say "Cinquième voyelle      --> @(voyelles 5)")',
        '#(say "Sixième   voyelle      --> @(voyelles 6)")',
        '#(say "Voyelles 2 et 4        --> " @(voyelles 2 4))',
        '#(say "Voyelles 4 et 2        --> " @(voyelles 4 2))',
        '#(say "Voyelles 4, 3, 4 et 2  --> " @(voyelles 4 3 4 2))',
        '#(say "Voyelles renversées    --> " @(voyelles 6 5 4 3 2 1))',
        '#(say)',
        '#(say "== 4 == PRESENCE D\'UNE VALEUR DANS UN OBJET MUFFINMC -> retourne le rang, ou bien 0")',
        '#(element a $(voyelles))',
        '#(element e $(voyelles))',
        '#(element i $(voyelles))',
        '#(element o $(voyelles))',
        '#(element u $(voyelles))',
        '#(element y $(voyelles))',
        '#(map \'( #(element $(_1) $(voyelles))) $(voyelles))',
        '#(map \'( #(element $(_1) $(voyelles))) #(.. a z))',
        '#(say)',
        '#(say "== 5 == DEFINITION ET UTILISATION D\'OBJETS FONCTIONNELS")',
        '=( est-une-voyelle  \'( #(element $(_1) $(voyelles))) )',
        '=( est-une-consonne \'( #(not #(est-une-voyelle $(_1)))) )',
        '=( lettres #(.. a z))',
        '#(map est-une-voyelle  $(lettres))',
        '#(map est-une-consonne $(lettres))',
        '=(voyelles-again  #(filter est-une-voyelle  $(lettres)))',
        '=(consonnes-again #(filter est-une-consonne $(lettres)))',
        '#(say)',
        '#(say "== 6 == A VOUS MAINTENANT...")',
        '=(l 0 1 2 3 4 5 6 7 8 9)',
        '=(index_impairs 2 4 6 8 10)',
        '=(index_pairs 1 3 5 7 9)',
        '=(reverse 10 9 8 7 6 5 4 3 2 1)',
        '=(vars l index_impairs index_pairs reverse vars)',
        '@(l)',
        '@(index_impairs)',
        '@(index_pairs)',
        '@(reverse)',
        '@(vars)',
        '@($(l))',
        '@($(index_impairs))',
        '@($(index_pairs))',
        '@($(reverse))',
        '@($(vars))',
        '@(l $(index_pairs))',
        '@(l $(index_impairs))',
        '@(l $(reverse))',
        '@(l $(index_impairs) $(index_pairs) $(reverse))',
        '@(l $(index_impairs index_pairs reverse))',
        '#(l)',
        '#(l l l)',
        '=(ll l l l)',
        '=(ll #(l))',
        '$(ll)',
        '#(# #(.. -10      -1 )     )',
        '#(# #(.. "-$(ll)" -1 )     )',
        '#(# #(.. "-#(l)"  -1 )     )',
        '#(# #(.. -1       -10)     )',
        '#(# #(.. -1      "-$(ll)") )',
        '#(# #(.. -1      "-#(l)")  )',
        '#(.. -10      -1      )',
        '#(.. "-$(ll)" -1      )',
        '#(.. -1       -10     )',
        '#(.. -1      "-$(ll)" )',
        '@(l -1 -2 -3 -4 -5 -6 -7 -8 -9 -10)',
        '@(l #(.. -1   -10     )           )',
        '@(l #(.. -1  "-#(l)"  )           )',
        '@(l #(.. -1  "-$(ll)" )           )',
        '@(l -10 -9 -8 -7 -6 -5 -4 -3 -2 -1)',
        '@(l #(..  -10     -1  )           )',
        '@(l #(.. "-#(l)"  -1  )           )',
        '@(l #(.. "-$(ll)" -1  )           )',
        '@(a b c d e f)',
        '@(l $(l))',
        '@("foo bar" 1 1)',
        '=(ll l l l)',
        '#($(ll))',
        '=(L $(ll))',
        '@($(L) 1 1 2 3 3)',
        '@($(L) 0 -1 -2 -3)',
        '#(say "== 7 == ON AVANCE...")',
        '=(foo foo bar)',
        '$(foo)',
        '"$(foo)"',
        '"1 L(a "$(foo)" b) 2"',
        '"1 L(a  $(foo)  b) 2"',
        '"1 #(. L(a " $(foo) " b)) 2"',
        '"1 #(. a " $(foo) " b) 2"',
        '"1 $(foo) 2"',
        '"1 #(.$(foo)) 2"',
        '"1 #(." $(foo) ") 2"',
        '"1 ,L(a "$(foo)" b) 2"',
        '"1 ,L(a  $(foo)  b) 2"',
        '#(+ 0 1 2 3 4 5 6 7 8 9)',
        '#(map \'(a) 0 1 2 3 4 5 6 7 8 9)',
        '#(map "a b" 1 2 3 4 5)',
        '#(map \'("a b") 1 2 3 4 5)',
        '=(foo a b)',
        '#(map $(foo) 1 2 3 4 5)',
        '#(map \'($(foo)) 1 2 3 4 5)',
        '=(foo \'("a b"))',
        '#(map $(foo) 1 2 3 4 5)',
        '=(square \'(#(* $(_1) $(_1))))',
        '#(map $(square) #(.. 1 10))',
        '#(map \'(#(* $(_1) $(_1)))  #(.. 1 10))',
        '=(consonnes-2  c g m)',
        '=(voyelles-2   a e i o u y)',
        '#(eval "( #(map   \'(#(. @(consonnes-2 $(_1)) ,$(voyelles-2)))   #(.. 1 #(consonnes-2)))) )',
        'M( "( #(map   \'(#(. @(consonnes-2 $(_1)) ,$(voyelles-2)))   #(.. 1 #(consonnes-2)))) )',
        '=(* C L(c g m) V L(a e i o u y)) =(combistr M("("$(C)#(. $ (V))")))',
        '=(* C L(c g m) V L(a e i o u y)) =(combistr M("("$(C),$(V)")))',
        '#(a b c d)',
        '=("f o o" f o o)',
        '#("f o o")',
        '#("f o o" c d)',
        '#(+ 1 2 3 4 5)',
        '=("+ - * /" + - * /)',
        '#("+ - * /" 1 2 3 4 5)',
        '#("+ - * /")',
        '#($("+ - * /") 1 2 4 8)',
        '#($("+ - * /") 1 2 4 8)',
        '=(gcd1 \'(    #(cmp? $(_1) $(_2) #(gcd1 $(_1) #(- $(_2) $(_1))) $(_1) #(gcd1 #(- $(_1) $(_2)) $(_2)))))',
        '=(gcd2 \'(    ?( #(== $(_2) 0) $(_1) #(self $(_2) #(mod $(_1) $(_2))))))',
        '=(gcd225 \'( #(gcd2 225 $(_1)) ) )',
        '#(gcd1 225 3)',
        '#(gcd2 225 5)',
        '#(gcd1 225 9)',
        '#(gcd2 225 15)',
        '#(gcd1 225 25)',
        '#(gcd2 225 27)',
        '#(gcd1 225 45)',
        '#(gcd2 225 75)',
        '#(gcd1 225 125)',
        '#(gcd2 225 81)',
        '#(gcd1 225 135)',
        '#(gcd2 225 225)',
        '#(gcd1 225 625)',
        '#(map gcd225 3 5 9 15 25 27 45 75 125 81 135 225 625)',
        '=(fact \'( ?( #(le $(_1) 1) 1 #(* $(_1) #(self #(1- $(_1)))))))',
        '#(fact 0)',
        '#(fact 1)',
        '#(fact 2)',
        '#(fact 3)',
        '#(fact 4)',
        '#(fact 5)',
        '#(fact 6)',
        '#(map fact #(.. 1 10))',
        '=(* x 0 y 1 fibit   I( #(prog1 $(y) =(* x $(y) y #(+$(x)$(y))))))',
        '#(fibit 1)',
        '#(fibit 1)',
        '#(fibit 1)',
        '#(fibit 1)',
        '#(fibit 2)',
        '#(fibit 6)',
        '=(reset-fibit \'( #(progn  =(* x 0 y 1) #(fibit $(_1)))))',
        '#(reset-fibit 15)',
        '=(reset-fibit-2 \'( P( =(* x 0 y 1) #(fibit $(_1)))))',
        '#(reset-fibit-2 15)',
        '=(* x 0 y 1 fibit2  I( 1($(y) =(* x $(y) y #(+$(x)$(y))))))',
        '=(reset-fibit-3 \'( P( =(* x 0 y 1) #(fibit2 $(_1)))))',
        '#(reset-fibit-3 15)',
        '=(fib-fun \'( #(== #(progn =(* x 0 y 1) #(+ #(map fibit #(.. 1 $(_1))))) #(progn =(* x 0 y 1) #(+ #(fibit #(+ #(.. 1 $(_1)))))))))',
        '#(map fib-fun #(.. 1 20))',
        '#(map 1 #(.. 1 20))',
        '=(fib-fun-2 \'( #(== P( =(* x 0 y 1) #(+ #(map fibit #(.. 1 $(_1))))) P( =(* x 0 y 1) #(+ #(fibit #(+ #(.. 1 $(_1)))))))))',
        '#(map fib-fun-2 #(.. 1 20))',
        '#(reset-fibit 1)',
        '#(reset-fibit 2)',
        '#(reset-fibit 3)',
        '#(reset-fibit 4)',
        '#(reset-fibit 5)',
        '#(fibit 1)',
        '#(fibit 2)',
        '#(fibit 3)',
        '#(fibit 4)',
        '#(fibit 5)',
        '=(it I( *(3 "_") N))',
        '#(it 3)',
        '#(it 3)',
        '#(it 3)',
        '#(it 3)',
        '#(it 3)',
        '=(* x 3 it I( *($(x) "_") N))',
        '#(it 3)',
        '#(it 3)',
        '#(it 3)',
        '#(it 3)',
        '#(it 3)',
        '#(say)',
        '#(say "== 7 == ASCII-ART")',
        '=(ascii-art \'( P( =(* x   #(2- $(_1)) I   I(*($(x)" ")N) foo \'( #(. #(I $(x))))) #(say ?(#(== $(_1) 1) N "N#(map foo #(.. 1 $(_1)))N")))))',
        '#(ascii-art 1)',
        '#(ascii-art 3)',
        '#(ascii-art 5)',
        '#(ascii-art 7)',
        '#(ascii-art 9)',
        '#(map \'( #(ascii-art $(_1))) 1 3 5 7 9)',
        '#(say)',
        '#(say "== 8 == MATRIX OPERATIONS")',
        '=(M L([ L([ #(.. 111 115) ) L([ #(.. 121 125) ) L([ #(.. 131 135) ) L([ #(.. 141 145) )) L([ L([ #(.. 211 215) ) L([ #(.. 221 225) ) L([ #(.. 231 235) ) L([ #(.. 241 245) )) L([ L([ #(.. 311 315) ) L([ #(.. 321 325) ) L([ #(.. 331 335) ) L([ #(.. 341 345) )))',
        '@([ M 1 * *)',
        '@([ M 2 * *)',
        '@([ M 3 * *)',
        '@([ M * 1 *)',
        '@([ M * 2 *)',
        '@([ M * 3 *)',
        '@([ M * 4 *)',
        '@([ M * * 1)',
        '@([ M * * 2)',
        '@([ M * * 3)',
        '@([ M * * 4)',
        '@([ M * * 5)',
        '@([ M * * *)',
        '#(# @([ M * * *))',
        '#(+ @([ M * * *))',
        '@([ M L(1 2) L(3 4) 5)',
        '@([ M L(3 2 1) L(4 3 2 1) L(5 4 3 2 1))',
        '@([ M #(.. 3 1) #(.. 4 1) #(.. 5 1))',
        '#(say)',
        '=(* MuffinMC Muffin remember-muffin 2015)',
        '#(say "$(MuffinMC) was born in $(remember-muffin) out of necessity ;)" )',
        '#(say)',
        '#(say)',
        '#(say "MUTINY TAHITI => Ci-dessous un exemple réel de constitution d\'un mini inventaire produit: production des déclinaisons et ajustement automatique du prix en fonction des caractéristiques (Cf. ligne \"INVENTAIRE-MUTINY\"). On constatera aisément la puissance expressive des formules Muffin<i>MC</i> ;)")',
        '#(say)',
        '=(* couleurs L(jaune rouge bleu vert) tailles L(S M L XL) col L(rond V zipper) prix-de-base 3000 supplément-prix L(Couleur:jaune -100 Couleur:rouge +200  Couleur:bleu +100 Couleur:vert +0 Taille:S -200 Taille:M +0 Taille:L +400 Taille:XL +500 Col:rond +0 Col:V +500 Col:zipper +1000))',
        '=(calcul-du-prix \'( #(+ $(prix-de-base) #(assoc S(_1) $(supplément-prix)))))',
        '=(INVENTAIRE-MUTINY #(map  \'("$(_1) => #(calcul-du-prix $(_1)) CFP") "Couleur:$(couleurs) Taille:$(tailles) Col:$(col)"))',
        '#(say)',
        '#(say "EXEMPLE 2")',
        '#(say)',
        '=(Prix_Article \'( #(+ #(assoc* $(_1) MODEL=1 1000 MODEL=2 2000 MODEL=3 3000 XTRA=1 100 XTRA=2 200 XTRA=3 300 XTRA=4 400 XTRA=5 500 TH=3 30 TH=4 40 TH=5 50 CT=1 1 CT=3 3 CT=4 4 CT=5 5 CT=6 6 * NONE))))',
        '=(Description_Article \'("(#(assoc* $(_1) MODEL=1 "Tshirt MUTINY Vintage; " MODEL=2 "Tshort Kalachnikov; " MODEL=3 "Tshirt Vespa; " XTRA=1 "Capuche; " XTRA=2 "Ouverture zippée; " XTRA=3 "Ouverture boutons; " XTRA=4 "Maille piquée; " XTRA=5 "Bretelles; " TH=3 "Homme Taille médium; " TH=4 "Home Taille large; " TH=5 "Homme grande taille; " CT=1 "Coloris Heather Tan" CT=3 "Coloris Heather Navy" CT=4 "Coloris Bleu" CT=5 "Coloris Asphalte" CT=6 "Coloris Métal" * "???"))))',
        '=(Créer_Article \'( "#(Description_Article $(_1)). Prix: #(Prix_Article $(_1)) CFP." ))',
        '=(Catalogue_Mutiny #(map Créer_Article "A(MODEL= 1 2 3) A(XTRA= "1 2" 3 "4 5") A(TH= 3 4 5) A(CT= 1 3 4 5 6)" ))',
        '#(say)',
        '#(say "Je ne connais pas de langage aussi concis que Muffin<i>MC</i> pour produire aussi simplement de tels résultats. Bien entendu, Muffin<i>MC</i> est un petit langage fonctionnel Türing-complet spécialement créé pour ce type d\'opérations essentiellement ensemblistes. Cependant cela ne retire rien à ses qualités, et plus je l\'utilise dans le cadre de procédures de tests de non régression, plus j\'envisage de l\'utiliser pour programmer simplement des opérations pénibles à engendrer dans des langages pourtant aussi puissants que Perl ou Lisp inclus, qui n\'embarquent pas par défaut la sémantique ensembliste de Muffin<i>MC</i> et ses nombreux opérateurs associés :)"',
        '#(say)',
        '#(say "Démo MUTINY TAHITI terminée! Welcome et Happy Muffin<i>MC</i> programming !")',
        '#(say)',
        '#(say "1> Dépliez et étudiez chaque exemple en cliquant sur la ligne associée dans le panneau des résultats (le présent panneau ;) )")',
        '#(say "2> Rejouez chaque exemple en positionnant la souris dessus puis en tapant [CTRL]-V, suivi d\'un [RETURN] au niveau de la zone de saisie")',
        '#(say "3> Retrouvez tous les exemples ci-dessus dans l\'historique de la session, à faire défiler avec les flèches [HAUT] et [BAS]")'
]};
