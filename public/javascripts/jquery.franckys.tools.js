/*
 * jquery.franckys.tools.js -- A general jQuery extension adding missing features;
 *
 * PROJECT: MUTINY Tahiti
 *
 * Copyright (C) 2014,2015 Franck Porcher
 * Francky's Engineering <franck.porcher@franckys.com>
 * All rights reserved
 */

(function($) {

    /**
     * $.isJquery(o)
     */
    var keys_f = function(o) {
                o = o || this;
                return $.map(o, function(key, value) { return key } );
        },
        values_f = function(o) {
                o = o || this;
                return $.map(o, function(key, value) { return value } );
        };

    if (! $.isJquery ){
        $.extend({
            isJquery: function(o) { return o instanceof jQuery }
        });
    }
    if (! $.keys ){
        $.extend({
            keys:     keys_f,
            values:   values_f
        });
        $.fn.keys   =   keys_f;
        $.fn.values =   values_f;
    }

    /**
     *  Image natural dimensions
     *
     *  $.fn.naturalWidth      = function() { return this[0].naturalWidth;  };
     *  $.fn.naturalHeight     = function() { return this[0].naturalHeight; };
     *  $.fn.naturalDimensions = function() { 
     */
    function img(url) {
        var i = new Image;
        i.src = url;
        return i;
    };

    if ('naturalWidth' in (new Image)) {
        $.fn.naturalWidth      = function() { return this[0].naturalWidth;  };
        $.fn.naturalHeight     = function() { return this[0].naturalHeight; };
        $.fn.naturalDimensions = function() { 
            //console.log('[NaturalDimensions#1] Fetching for THIS:' + this[0] + '  width:' + this[0].naturalWidth + ' height:' + this[0].naturalHeight);
            var dim = {
                width:  this[0].naturalWidth,
                height: this[0].naturalHeight
            };
            dim.ratio = dim.width / dim.height;
            return dim;
        };
    }
    else {
        $.fn.naturalWidth      = function() { return img(this.src).width; };
        $.fn.naturalHeight     = function() { return img(this.src).height; };
        $.fn.naturalDimensions = function() { 
            //console.log('[NaturalDimensions#2] Fetching for THIS' + this); 
            var i = img(this.src);
            return {
                width:  i.width,
                height: i.height,
                ratio:  i.width / i.height
            };
        };
    }
})(jQuery);
