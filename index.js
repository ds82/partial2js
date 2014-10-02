//
// partial2js
// Copyright (c) 2014 Dennis Sänger
// Licensed under the MIT
// http://opensource.org/licenses/MIT
//
"use strict";

var glob    = require('glob-all');
var fs      = require('fs');
var path    = require('path');
var stream  = require('stream');
var htmlmin = require('html-minifier').minify;
var escape  = require('js-string-escape');

var eol     = require('os').EOL;

function Partial2Js( opts ) {

  opts = opts || {};

  var self = this;
  this.debug = !!opts.debug;

  this.patterns = [];
  this.files = [];
  this.contents = {};
  this.uniqueFn = function( file ) {
    return file;
  };

  var log = (function log() {
    if ( this.debug ) {
      console.log.apply( console, arguments );
    }
  }).bind( this );

  var find = (function() {
    this.files = glob.sync( this.patterns.slice( 0 )) || [];
  }).bind( this );

  function cleanPatterns( patterns ) {
    return patterns.map(function( entry ) {
      return entry.replace(/\/\*+/g, '');
    });
  }

  function compare( patterns, a, b ) {
    return matchInPattern( patterns, a ) - matchInPattern( patterns, b );
  }

  var sort = (function() {
    var clean = cleanPatterns( this.patterns );
    this.files.sort(function( a, b ) {
      return compare( clean, a, b );
    });
  }).bind( this );

  //
  // this function is not every functional ;)
  // Should use findIndex() [ES6] as soon as possible
  //
  function matchInPattern( patterns, entry ) {
    var res = patterns.length + 100;
    patterns.every(function( pattern, index ) {
      if ( entry.indexOf( pattern ) > -1 ) {
        res = index;
        return false;
      }
      return true;
    });
    return res;
  }

  var unique = (function() {

    if ( typeof this.uniqueFn === 'function' && this.files && this.files.length ) {
      var obj = {};
      this.files.forEach(function( file ) {
        var key = self.uniqueFn( file );
        if ( !obj[key] ) {
          obj[key] = file;
        }
      });
      this.files = obj;
    }

  }).bind( this );

  var asString = (function( moduleName ) {
    var buffer = '';

    buffer += '(function(window,document){' + eol;
    buffer += '"use strict";' + eol;
    buffer += 'angular.module("'+moduleName+'",[]).run(["$templateCache",function($templateCache){' + eol;

    for ( var k in this.contents ) {
      buffer += '  $templateCache.put("'+k+'","'+this.contents[k]+'");' + eol;
    }

    buffer += '}]);' + eol;
    buffer += '})(window,document);';

    return buffer;

  }).bind( this );

  var read = (function() {
    var id, path, stat;
    this.contents = {};

    for( var k in this.files ) {
      id = k;
      path = this.files[k];

      stat = fs.statSync( path );
      if ( stat.isFile()) {
        log('read file:', path, '=>', id );
        this.contents[id] = fs.readFileSync( path );
      }
    }

    return this.contents;

  }).bind( this );

  var asStream = function( string ) {
    var s = new stream.Readable();
    s._read = function noop() {};
    s.push( string );
    s.push(null);
    return s;
  };

  var minify = (function() {
    var opts = {
      collapseWhitespace: true,
      preserveLineBreaks: false,
      removeComments: true,
      removeRedundantAttributes: true,
      removeEmptyAttributes: false,
      keepClosingSlash: true,
      maxLineLength: 0,
      customAttrCollapse: /.+/,
      html5: true
    };

    for ( var k in this.contents ) {
      this.contents[k] = escape(htmlmin( String(this.contents[k]), opts ));
    }
  }).bind( this );

  this.add = function( pattern ) {
    this.patterns.push( pattern );
    return this;
  };

  this.not = function( pattern ) {
    this.patterns.push( '!'+pattern );
    return this;
  };

  this.folder = function( folder ) {
    if ( folder && String( folder ) === folder ) {
      folder = path.resolve( folder ) + '/**/*';
      this.patterns.push( folder );
    }
    return this;
  };

  this.unique = function( fn ) {
    this.uniqueFn = fn;
    return this;
  };

  this.stringify = function( moduleName ) {
    find();
    sort();
    unique();
    read();
    minify();
    return asString( moduleName );
  };

  this.stream = function( moduleName ) {
    return asStream( this.stringify( moduleName ) );
  };

}


module.exports = function( opts ) {
  return new Partial2Js( opts );
};
