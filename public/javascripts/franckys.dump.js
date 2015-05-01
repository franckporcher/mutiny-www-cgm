/*
 * dump.js -- 
 *
 * Copyright (C) 2013, Franck Porcher, Francky's, <franck.porcher@franckys.com>
 * All rights reserved
 *
 * Version: $Id$
 */
/*
dump() displays the contents of a variable like var_dump() does in PHP. dump() is
better than typeof, because it can distinguish between array, null and object.  
Parameters:
  v:              The data
  recursionLevel: Number of times the function has recursed when entering nested
                  objects or arrays. Each level of recursion adds extra space to the 
                  output to indicate level. Set to 0 by default.
Return Value:
  A string of the variable's contents 
Limitations:
  Can't pass an undefined variable to dump(). 
  dump() can't distinguish between int and float.
  dump() can't tell the original variable type of a member variable of an object.
  These limitations can't be fixed because these are *features* of JS. However, dump()
*/
var marge = [
    '',
    '   ',
    '      ',
    '         ',
    '            ',
    '               ',
    '                  ',
    '                     ',
    '                        ',
    '                           ',
    '                              '
];

function franckys_dump(v, maxdepth, recursionLevel) {
    maxdepth       = maxdepth       || 10;
    recursionLevel = recursionLevel || 0;

    if ( recursionLevel == maxdepth ) {
        return '...';
    }

    var vType = typeof v;
    var out   = vType;

    switch (vType) {
        case 'number':
            /* there is absolutely no way in JS to distinguish 2 from 2.0
            so 'number' is the best that you can do. The following doesn't work:
            var er = /^[0-9]+$/;
            if (!isNaN(v) &amp;&amp; v % 1 === 0 &amp;&amp; er.test(3.0))
                out = 'int';*/
            out += ': ' + v;
            break;

        case "boolean":
            out += ': ' + v;
            break;

        case 'string':
            out += '(' + v.length + '): "' + v + '"';
            break;

        case 'object':
            //check if null
            if (v === null) {
                out = 'null';
            }
            else if (Object.prototype.toString.call(v) === '[object Array]') {  
                out = 'array(' + v.length + '):[\n';
                for (var i = 0; i < v.length; i++) {
                    out += marge[recursionLevel] + '   [' + i + ']:  ' + 
                        franckys_dump(v[i], maxdepth, recursionLevel + 1) + '\n';
                }
                out += marge[recursionLevel] + ']';
            }
            else { // object    
                out = 'Object(' + Object.prototype.toString.call(v) + '):{\n';
                for (var member in v) {
                    //No way to know the original data type of member, since JS
                    //always converts it to a string and no other way to parse objects.
                    out += marge[recursionLevel] + '   ' + member +
                        ':  ' + franckys_dump(v[member], maxdepth, recursionLevel + 1) + '\n';
                }
                out += marge[recursionLevel] + '}';
            }
            break;
    }
    return out;
}
