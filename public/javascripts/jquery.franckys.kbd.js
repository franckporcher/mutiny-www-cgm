/**
 * jquery.franckys.kbd.js -- A Generic Keyboard Event Handler
 *
 * PROJECT: MUTINY Tahiti
 *
 * Copyright (C) 2014,2015 Franck Porcher
 * Francky's Engineering <franck.porcher@franckys.com>
 * All rights reserved
 */

/**
*---------------------------------------------------------
* jQuery extension
*---------------------------------------------------------
*
* keycode = $.kbdKeycode(key)
* bool    = $.kbdStatus(key)        => true(pressed) / false(not pressed)
* hid     = $.kbdRegister(keys, cbon, cboff, modifiers, zone-selectors)
* hid     = $(jquery-selector).kbdRegister(keys, cbon, cboff, modifiers, zone-selectors)
*               cb:: function(keycode, status){...}
*               modifier is [{key :true/false,...}...]
*               modifier must be true for KBD to fire the cb
* n       = $.kbdUnregister(hid [, keys...])
*
*
* EXEMPLES:
*
*   var $lookup  = $('#lookup'),
*       $overlay = $('#overlay'),
*       $go      = $('#go');
*
*   $lookup.kbdRegister(
*       'ENTER', 
*       function(){ 
*           //$go.trigger('click');
*           $go.click();
*       }
*   );
*            
*   $overlay.kbdRegister(
*       ['ENTER','ESC'], 
*       overlay_close,
*       {'CTRL': true}
*   );
*
*   // Escape
*   $.kbdRegister(
*       ['ESC', '-', 'TIRET', 'M'], 
*       function() {
*           if (! liveview.exit() ) {
*               tij.collapse_menu();
*               tij.bm_close_panel();
*           }
*       }
*  );
*
*    var debug = function() {
*  var $logo = $('#logo');
*
*  var hid1 = $logo.kbdRegister(
*            ['A', 'Z'],
*            function(keycode){ console.log(" key pressed:" + keycode + ' in #logo zone') },
*            { 'MAJ': true }
*        );
*
*  var hid2=$.kbdRegister(
*            ['ENTER'],
*            function(keycode){ console.log("Enter pressed:" + keycode + ' anywhere') }
*        );
*
*/
(function($) {
    "use strict";

    /*
     * kbd:
     *      registered: {
     *          n:... ,                         // Number of registered keyboard handlers
     *          [n]: {                          // Descriptor for the hid = 1..n (not zero)
     *              keycodes:   [keycode,...],  //list of keycodes for that handler,
     *              cbon:       cbon,
     *              cboff:      cboff,
     *              modifier:   modifier,*
     *              zone:       jquery object
     *              zev:        string as a pseudo-event triggered by
     *                          mouseon/mouseoff the associated elements...
     *                          "zev_<hid>" so it is unique
     *              },
     *            ...
     *      },
     *      handlers:   { 
     *          keycode: { 
     *              on: [handlers],
     *              off:[handlers], 
     *              modifiers:[...]
     *          },
     *          ...
     *      }  // Handlers registered
     *      keycode:    { SYMBOLE: keycode,       ...}  // Codes numériques des touches clavier
     *      <keycode>:  false/true,                     // State of each keycode (true==keypressed)
     *      <zev_hid>:  false/true
     */
    var kbd = {
        registered: {
            n: 0
            // <i[1..]>: { keycodes: list, on: cbon, off:cboff, modifier: foo}
        },
        handlers: {},
        zones:    {
            list:    [] // List of referenced zones (DOM objects)
            // <zid>: { refcount:  compteur de références (i est l'indice de la zone dans "doms")
            //          dom:       zone's DOM object
        },
        keycode: {
           BTAB:  8,
            TAB:  9,
        LOCKNUM: 12,
          ENTER: 13,
            MAJ: 16,
          SHIFT: 16,
            CTL: 17,
           CTRL: 17,
            ALT: 18,
      LOCKSHIFT: 20,
            ESC: 27,
          SPACE: 32,
           PREV: 33,
          PPREV: 33,
          PPREC: 33,
           NEXT: 34,
          PNEXT: 34,
          PSUIV: 34,
            END: 35,
            FIN: 35,
           HOME: 36,
           ORIG: 36,
           LEFT: 37,
         GAUCHE: 37,
             UP: 38,
           HAUT: 38,
          RIGHT: 39,
         DROITE: 39,
           DOWN: 40,
            BAS: 40,
           SUPP: 46,
          SUPPR: 46,
          DEL:   46,
          TIRET: 54,
              A: 65,
              B: 66,
              C: 67,
              D: 68,
              E: 69,
              F: 70,
              G: 71,
              H: 72,
              I: 73,
              J: 74,
              K: 75,
              L: 76,
              M: 77,
              N: 78,
              O: 79,
              P: 80,
              Q: 81,
              R: 82,
              S: 83,
              T: 80,
              U: 85,
              V: 86,
              W: 87,
              X: 88,
              Y: 89,
              Z: 90,
           PRINT:93,
              0: 96,
              1: 97,
              2: 98,
              3: 99,
              4:100,
              5:101,
              6:102,
              7:103,
              8:104,
              9:105,
            '*':106,
            '+':107,
            '-':109,
            '/':111,
           META:224
            }
        },

        /***************************
         * KBD Zones (DOM objects registered for mouse events)
         ***************************/
        zone_ref = function (zone) {
            var zidx = kbd.zones.list.indexOf(zone),
                zid;

            if (zidx == -1) {
                // Register new zone
                zidx = kbd.zones.list.length; // Zone's index
                kbd.zones.list.push(zone);
                zid = 'ZID_' + zidx;          // Zone's id

                // Initialize zone's DOM & reference counter
                kbd.zones[zid] = {
                    refcount: 0,
                    dom:      zone
                };

                // Initialize zone's mouse-event (see zone as 
                // a pseudo "zone-event"
                kbd[zid] = false;
                kbd.keycode[zid] = zid;
            }
            else {
                // Zone already registered
                zid = 'ZID_' + zidx;
            }

            // Increment zone's reference counter
            kbd.zones[zid].refcount++;

            // Reset zone's mouse-triggers as needed
            if (kbd.zones[zid].refcount == 1) {
                $(zone)
                    .mouseenter( function(){ kbd[zid] = true  } )
                    .mouseleave( function(){ kbd[zid] = false } )
            }

            // return zone id
            return zid;
        },

        zone_unref = function (zid) {
            kbd.zones[zid].refcount--;
            if (kbd.zones[zid].refcount == 0) {
                $(kbd.zones[zid].dom).unbind('mouseenter mouseleave');
            }
        },

        /***************************
         * KBD module
         ***************************/
        module = { 

            /**
             * keycode(key)
             *
             * Returns the keycode of a symbolic KEY
             * or 'undefined' if the key is not defined
             */
            keycode: function(key) {
                return kbd.keycode[key];
            },

            /**
             * status(key)
             *
             * Return true if the key is pressed, false if it not
             * 'undefined' if the key is not defined
             *
             */
            status: function(key) {
                var keycode = kbd.keycode[key];
                return (keycode === undefined) ? undefined : kbd[keycode];
            },

            /**
             * [$(zones).[kbdNegz().]] register(key_or_list_of_keys, handler_on [, handler_off] [, modifiers])
             *
             * handlers are functions that will receive data in the form:  function(keycode, true|false)
             *  * true -> keydown
             *  * false -> keyup
             *  You *must* provide the closure you want if you need to bind 'this' on the right ojject upon
             *  running the hadler, for instance kbdRegister(xxx, *  myhandler.bind(myobj),...)
             *
             * Returns a unique handler id, that should be passed back for
             * deregistering
             *
             * Returns undefined if callback are not functions
             */
            register: function(keys, cbon, cboff, modifiers) {
                var zones    = $.isJquery(this) ? this : undefined,
                    modifier = '',
                    keycodes = [], keycode,
                    hid,
                    handlers, 
                    zids = [], zcond;

                /*
                console.log("[Register] arguments:" + arguments.length);
                console.log('           keys:' + keys);
                console.log('           isJquery(this):' + $.isJquery(this));
                console.log('           this.jquery:' + this.jquery);
                console.log('           this.length:' + this.length);
                */

                if ( arguments.length == 3 ) {
                    /*
                    if ( $.isJquery(cboff) ) {
                        zones  = cboff;
                        cboff  = undefined;
                    }
                    else 
                    */
                    if ( ! $.isFunction(cboff) ) {
                        modifiers = cboff;
                        cboff     = undefined;
                    }
                }

                // Keycodes
                if ( !$.isArray(keys) ) {
                    keys = [ keys ];
                }
                keys.forEach(function(key){
                    keycode = kbd.keycode[key]; // get the keycode
                    if (keycode !== undefined) keycodes.push(keycode);
                });

                if ( keycodes.length < 1 ) return;

                // Handler ID
                hid = ++kbd.registered.n;

                /* On compile les modifiers en une fonction anonyme
                 *
                 * "Zones" incorporate into modifiers
                 *
                 * Ex: [ {ESC: true, MAJ: false}, {ENTER: true} ]
                 * => function modifier() {
                 *       return  ( kbd[27] && !kbd[16] ) || ( kbd[13] );
                 *    }
                 */
                if (zones) {
                    var zcond_list = [],
                        i        = 0,
                        len      = zones.length;

                    for (; i < len; i++) {
                        var zid = zone_ref( zones[i] );
                        zids.push(zid);
                        zcond_list.push("kbd['" + zid + "']");
                    }
                    zcond = zcond_list.join('||');

                    if ( zones.kbdnegz ) zcond = '!(' + zcond + ')';
                }

                if (modifiers) {
                    if ( !$.isArray(modifiers) ) modifiers = [ modifiers ];
                    var cond = [];
                    modifier
                        = modifiers
                         .map( function(o){
                                for (key in o) {
                                    keycode = kbd.keycode[key]; // get the keycode
                                    if (keycode !== undefined) cond.push( (o[key] ? '' : '!') + 'kbd[' + keycode + ']' );
                                }
                                return cond.join('&&');
                            })
                         .join('||');
                    // Incorporate zone condition => (zcond) && (modifier)
                    if (zcond) modifier = '(' + zcond + ')&&(' + modifier + ')';

                }
                else if (zcond) {
                    modifier = zcond;
                }

                if (modifier) {
                    //eval('modifier=function(){return ' + modifier + '}');
                    modifier = eval('var x=function(){return ' + modifier + '};x');
                }
                //console.log('[HID# ' + hid + '] modifier = ' + modifier);

                // Registering
                kbd.registered[hid] = {
                    keycodes: keycodes,
                        cbon: cbon,
                       cboff: cboff,
                    modifier: modifier,
                    zids:     zids
                };

                keycodes.forEach( function(keycode) {
                    handlers = kbd.handlers[keycode];
                    handlers.on.push(cbon);
                    //console.log('[KBD] Registered ' + keycode + '#cbon:' + cbon);
                    if ( cboff )    handlers.off.push(cboff);
                    if ( modifier ) handlers.modifiers.push(modifier);
                })

                return hid;
            },

            /**
             * unregister(hid [, keys])
             *
             * Unregister the registered handler for all its keys or only
             * a subset of, as given by keys.
             *
             * Returns the number of handlers unregistered
             */
            unregister: function(hid, keys) {
                if (kbd.registered[hid]) {
                    var descriptor     = kbd.registered[hid],
                        zids           = descriptor.zids,
                        descr_keycodes = descriptor.keycodes,
                        handlers,
                        idx,
                        keycode,
                        keycodes = [],
                        n = 0;

                    if ( keys !== undefined ) {
                        if ( !$.isArray(keys) ) {
                            keys = [ keys ];
                        }
                        keys.forEach(function(key){
                            keycode = kbd.keycode[key]; // get the keycode
                            if (keycode !== undefined) keycodes.push(keycode);
                        });
                    }
                    else keycodes = descr_keycodes;
                    //console.log('Asking to unregister keys:' + keycodes);

                    keycodes.forEach( function(keycode) {
                        if ( (idx = descr_keycodes.indexOf(keycode)) >= 0 ) {
                            descr_keycodes.splice(idx,1); // unregister for this hid's keycode
                            //console.log('Deleting:' + keycode + ' idx:' + idx + ' Remain:' + kbd.registered[hid].keycodes);
                            //console.log('[KBD] Unregistering for keycode:' + keycode);
                            handlers = kbd.handlers[keycode];
                            idx = handlers.on.indexOf(descriptor.cbon);
                            handlers.on.splice(idx,1);
                            n++;
                            if ( descriptor.cboff && (idx = handlers.off.indexOf(descriptor.cboff)) >= 0 ) handlers.off.splice(idx,1);
                            if ( descriptor.modifier && (idx = handlers.modifiers.indexOf(descriptor.modifier)) >= 0 ) handlers.modifiers.splice(idx,1);
                        }
                    })
                    if ( descr_keycodes.length > 0 ){
                        if (n) kbd.registered[hid].keycodes = descr_keycodes;
                        //console.log('Still registered: ' + kbd.registered[hid].keycodes);
                    }
                    else {
                        // Handler has unregistered for ALL its keycodes
                        var  len = zids.length;
                        if ( len > 0 ) {
                            for(var i=0; i < len; i++) {
                                zone_unref(zids[i]);
                            }
                        }
                        delete kbd.registered[hid];
                    }
                    
                    return n;
                }
                return false;
            }
        };

    for (var key in kbd.keycode){
        var keycode           = kbd.keycode[key];
        kbd[keycode]          = false;
        kbd.handlers[keycode] = {
            on:  [], 
            off: [], 
            modifiers: []
        };
    }
        
    /**
     * KBD EVENTS
     */
    $(window)
        .keydown( function(event) {
            event.stopPropagation();
            var keycode = event.keyCode,
                handlers;

            //console.log('[KBD] Down:' + keycode);
            if (kbd[keycode] !== undefined){ // keycode is handled
                kbd[keycode] = true;
                handlers = kbd.handlers[keycode];

                for (var i=0, len=handlers.on.length; i<len; i++){
                    //console.log('[KBD] keycode:'+keycode + ' CBON:' + len + ' CBON#' + i + ':' + handlers.on[i] + ' mod:' + handlers.modifiers[i] + ' valuemod:' + ( handlers.modifiers[i] ? (handlers.modifiers[i])() : true ));
                    ( handlers.modifiers[i] ? (handlers.modifiers[i])() : true ) && handlers.on[i] && (handlers.on[i])(keycode,true);
                }
            }
        })
        .keyup( function(event) {
            var keycode = event.keyCode,
                handlers;
            //console.log('[KBD] Up:' + keycode);
            if (kbd[keycode] !== undefined){
                kbd[keycode] = false;
                handlers = kbd.handlers[keycode];
                for (var i=0, len=handlers.off.length; i<len; i++){
                    //console.log('[KBD] keycode:'+keycode + ' CBOFF:' + len + ' CBOFF#' + i + ':' + handlers.off[i]);
                    handlers.off[i] && (handlers.off[i])(keycode,false);
                }
            }
        });

    // DEBUG 
    $.kbdHandlers = kbd.handlers;
    // DEBUG 
    $.kbdRegistered = kbd.registered;
    //return module;

    /**
    function kbdRegister(){
            console.log('[$.register] this:' + this + ' isJquery(' + $.isJquery(this) + ')');
            console.log('[$.register] this.jquery:' + this.jquery);
            console.log('[$.register] this.length' + this.length);
            return module.register.apply(this, arguments);
    };
    */
    $.fn.kbdRegister   =  module.register;
    $.fn.kbdNegz       =  function(){this.kbdnegz = true; return this};
    $.extend({
        kbdKeycode:     module.keycode,
        kbdStatus:      module.status,
        //kbdRegister:    kbdRegister,
        kbdRegister:    module.register,
        kbdUnregister:  module.unregister
    });
})(jQuery);
