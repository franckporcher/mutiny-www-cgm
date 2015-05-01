/*
 * Franckys.js :: useful little library...
 *
 * Copyright (C) 2013, Franck Porcher - "Franck Porcher"<franck.porcher@franckys.com>
 *
 * Version: $Id$
 */
( 
    function () {
    "use strict";                       //ECMAScript 5

    // Emulate Object.create
    if (! Object.create) {
        Object.create = function (proto, properties) {
            var F = function () {};       // dummy constructor
            F.prototype = proto;        // inherits proto 
            var o = new F();            // our newly created object

            if (properties) {
                for (var p in properties) {
                    if ( properties.hasOwnProperty(p) ) {
                        o[p] = properties[p];
                    }
                }
            }
    
            return o;
        };
    }

    // Transform array-like objects (like Arguments) into real arrays (copy)
    if (! Array.toArray ) {
        Array.toArray = function (array_like) {
            return Array.prototype.map.call( array_like, function (x) {return x;} );
        };
    }
    
    // Chain versions of splice(), push(), pop(), shift(), unshift()
    // that returns the resulting array they operate on, so chaining
    // is possible.
    //
    // a.chain("f",arg1...) => a.f(arg1...) but returns a
    //
    // Example:
    //  var a = [2,3,4]
    //  var square = function(n){return n*n}
    //  a.chain("unshift",1).chain("push",5,6).map( square ).chain("splice",0,2)
    //  => [9,16,25,36]
    //  a 
    //  => [9,16,25,36]
    if (! Array.prototype.chain ) {
        Array.prototype.chain = function (f /*, method args */) {
            var args = Array.toArray(arguments);
            args.shift();
            Array.prototype[f].apply(this, args);
            return this;
        };
    }

    // bind with currying (partial application)
    if (! Function.prototype.bind) {
        Function.prototype.bind = function (o /*, optional args for currying */) {
            var f    = this;
            var args = Array.toArray(arguments).chain("shift"); // currying args, without o

            return function() {
                return f.apply(o, args.concat( Array.toArray(arguments) ) );
            };
        };
    }

})();

// Franckys
var Franckys = ( 
    function () {
        var franckys = {};

        // I (lambda calcul)
        franckys.I = function (x) { 
            return x; 
        };
        
        // prog1 -- Returns its first argument (LISP)
        franckys.prog1 = franckys.I;

        // irand(n) -- returns a random integer value in [0,n]
        franckys.irand = function (n) { 
            return Math.floor(Math.random() * n); 
        };

    
        // class(o)  => returns the name of class of the object o, as a string
        franckys.class = function (o) {
            o = o || this;
            if (o === null)      { return "Null";      }
            if (o === undefined) { return "Undefined"; }
            return Object.prototype.toString.call(o).slice(8,-1);
        };

        franckys.extend = function (subclass, superclass) {
            var proto = new superclass;
            for (var p in proto) {
                if (proto.hasOwnProperty(p)) { delete proto[p]; }
            }
            proto.constructor  = subclass;
            proto.super        = superclass;
            subclass.prototype = proto;
            return subclass;
        };


        franckys.promise = {
            /**
            * forEach(list,foo) -- asynchronously iterate thru the list
            *                      and calling foo for each elt while binding
            *                      this to the this we received
            *
            * --> resolve(true)
            */
            forEach:    function (l, foo, index) { // foo(list_element, list_index, wholelist){...}
                    var deferred_foreach = new jQuery.Deferred();
                    var obj   = this;
                    index = index || 0;
//alert("--> forEach index="+index+ "; l.length=" + l.length);

                    if ( index < l.length ) {
                        var e = l[index];
//alert("forEach test=" + e + "; foo=" + foo);

                        foo.call(obj, e, index, l).always(
                            function(foo_res){
                                franckys.promise.forEach.call(obj, l, foo, index+1).always(
                                    function(foreach_res){ deferred_foreach.resolve(foreach_res); }
                                );
                            }
                        );
                    }
                    else {
                        deferred_foreach.resolve(true);
                    }

                    return deferred_foreach.promise();
            },  /* forEach */

            /**
            * while_true(do) -- do { foo() } while true asynchronously
            *                   calling  foo with the value of the iteration,
            *                   starting with 1 (not 0)
            *
            * .resolve(n) -- number of iterations done
            */
            while_true: function (foo, index) { // foo(index){...}
                var deferred = new jQuery.Deferred();
                var obj      = this;
                index        = index || 1;
//alert("--> while_true("+index+")");

                foo.call(this, index).then(
                    // foo is true
                    function(foo_res){
                        franckys.promise.while_true.call(obj, foo, index+1).always(
                            function(n_iter){ deferred.resolve(n_iter); }
                        );
                    },
                    // foo is false
                    function(foo_err){
                        deferred.resolve(index-1);
                    }
                );

                return deferred.promise();
            }  /* forEach */



        };


        return franckys;
    }
) ();
