/*
 * jquery.franckys.async.js -- A general jQuery extension for CGM easy asynchronous programming
 *
 * PROJECT: MUTINY Tahiti
 *
 * Copyright (C) 2014,2015 Franck Porcher
 * Francky's Engineering <franck.porcher@franckys.com>
 * All rights reserved
 *
 */
(function($) {
    /**
     * $.async(  f1, f2, f3...  ).then().done(...).fail(...).always(...)
     * $.async( [f1, f2, f3...] ).then().done(...).fail(...).always(...)
     *
     * Where fi's are functions that *must* return $.Deferred objects
     * or are $.Deferref objects themselves waiting to be resolved.
     *
     * The fi's receive in turn the aggregated result
     * [{value: value, status: done/fail}, ...]
     *
     * Which is also passed back to the master result
     *
     * Returns a master deferred
     */
    var afoo = function(dfd, aseq, res) { //this === {aseq: [f1, f2, ...], dfd: dfd}
        //console.log('[AFOO] ASEQ:' + aseq.length + '  RES:' + res);
        if ( aseq.length == 0 ) {
            //console.log('[AFOO] DONE!, resolving with RES:' + res);
            dfd.resolve(res);
        }
        else {
            var a = aseq.shift();
            $.when( $.isFunction(a) ? a(res) : a )
                .done( function(fres){
                    //console.log('[AFOO] Fi resolved with:' + fres + ' recurse');
                    res.push( {value: fres, status: 'done'} );
                    afoo(dfd, aseq, res);
                })
                .fail( function(fres){
                    res.push( {value: fres, status: 'fail'} );
                    afoo(dfd, aseq, res);
                });
        }
    };

    /**
     * $.aDeferred(x)
     */
    $.extend({
        async: function() {
            var dfd  = jQuery.Deferred();
            if ( arguments.length > 0 && $.isArray(arguments[0]) ) {
                afoo(dfd, arguments[0], []);
            }
            else {
                afoo(dfd, [].splice.call(arguments, 0), []);
            }
            return dfd;
        } 

        /*
        isDeferred: function(o) {
            return $.isArray(o) && o.resolve;
        },

        aDeferred: function(o) {
            if ( $.isDeferred(o) ) {
            }
            else {
            }
        }
        */
    });

        /**
         * dfd.prepare_resolve(f1,...fn) fi optional
         *
         * retourne la dfd
         *
         * retourne une closure ready to run dfd.resolve ou dfd.async
         * dans le futur sur une dfd connue des qu'une condition devient
         * vraie dans le futur
        var prepare_resolve  = function(){
            var dfd = this;
            if (arguments.length > 0) {
                var aseq = [].splice.call(arguments, 0);
                $.when( $.async( aseq ) ).always( function(){ dfd.resolve(); } );
            }
            else {
                dfd.resolve();
            }
            return dfd;
        };
        $.fn.prepare_resolve = function(){ return prepare_resolve.bind(this, arguments); };
         */

})(jQuery);
