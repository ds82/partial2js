var proxyquire = require('proxyquire');
var eol        = require('os').EOL;
var path       = require('path');

var Readable   = require('stream').Readable;

var stubs            = {};
stubs['glob-all']    = jasmine.createSpyObj('glob', ['sync']);

stubs.fs             = jasmine.createSpyObj('fs',   ['readFileSync', 'statSync']);
stubs.fs.statSync.andReturn({
  isFile: function() { return true; }
});

stubs['@noCallThru'] = true;

var uutFile    = proxyquire('../', stubs );

describe('partial2js', function() {

  var uut;

  beforeEach(function() {
    uut = uutFile();
  });

  it('should not return the same instance twice', function() {
    expect( uut ).not.toEqual( uutFile() );
  });

  describe('add()', function() {

    it('should have a add() function', function() {
      expect( uut.add ).toBeDefined();
    });

    it('should return the class', function() {
      expect( uut.add() ).toEqual( uut );
    });

    it('should add pattern to include', function() {
      expect( uut.patterns ).toEqual( [] );

      var pattern = '*.tpl';
      uut.add( pattern );

      expect( uut.patterns ).toEqual( [pattern] );
    });
  });

  describe('folder()', function() {

    it('should have a folder() function', function() {
      expect( uut.folder ).toBeDefined();
    });

    it('should return the class', function() {
      expect( uut.folder() ).toEqual( uut );
    });

    it('should add a folder pattern to patterns', function() {
      expect( uut.patterns ).toEqual( [] );

      var folder = '/tmp/some/path/';
      uut.folder( folder );

      expect( uut.patterns ).toEqual( [ folder + '**/*' ] );
    });
  });

  describe('not()', function() {

    it('should have a not() function', function() {
      expect( uut.not ).toBeDefined();
    });

    it('should return the class', function() {
      expect( uut.not() ).toEqual( uut );
    });

    it('should add pattern to exclude', function() {
      expect( uut.patterns ).toEqual([]);

      var pattern = 'foo.bar';
      uut.not( pattern );

      expect( uut.patterns ).toEqual([ '!'+pattern ]);
    });
  });


  describe('stringify()', function() {

    it('should have a stringify() function', function() {
      expect( uut.stringify ).toBeDefined();
    });

    it('should return a string', function() {
      expect( uut.stringify() ).toEqual( jasmine.any( String ));
    });

    it('should rebuild file list', function() {
      var files = ['file1', 'file2'];

      // default unique filter
      var fileObj = {};
      files.forEach(function( file ) {
        fileObj[file] = file;
      });

      stubs['glob-all'].sync.andReturn( files );

      uut.stringify();
      expect( uut.files ).toEqual( fileObj );
      expect( stubs['glob-all'].sync ).toHaveBeenCalled();
    });

    it('should return script tags', function() {

      stubs.fs.readFileSync.reset();

      var files = ['file1', 'file2'];

      stubs['glob-all'].sync.andReturn( files );
      stubs.fs.readFileSync.andCallFake(function( file ) {
        return '<some>template for ' + file + '</some>';
      });

      var templates = uut.stringify('rea.templates');

      expect( stubs['glob-all'].sync ).toHaveBeenCalled();
      expect( stubs.fs.readFileSync ).toHaveBeenCalled();
      expect( stubs.fs.readFileSync.calls.length ).toEqual( 2 );

      var expected = '';

      expected += '(function(window,document){' + eol;
      expected += '"use strict";' + eol;
      expected += 'angular.module("rea.templates",[]).run(["$templateCache",function($templateCache){' + eol;
      expected += '  $templateCache.put("file1","<some>template for file1</some>");' + eol;
      expected += '  $templateCache.put("file2","<some>template for file2</some>");' + eol;
      expected += '}]);' + eol;
      expected += '})(window,document);';

      expect( templates ).toEqual( expected );
    });

    it('should be able to generate empty module', function() {
      var files = [];

      stubs.fs.readFileSync.reset();
      stubs['glob-all'].sync.andReturn( files );
      // stubs.fs.readFileSync.andCallFake(function( file ) {
      // });

      var templates = uut.stringify('rea.templates');

      expect( stubs['glob-all'].sync ).toHaveBeenCalled();
      expect( stubs.fs.readFileSync ).not.toHaveBeenCalled();
      expect( stubs.fs.readFileSync.calls.length ).toEqual( 0 );

      var expected = '';

      expected += '(function(window,document){' + eol;
      expected += '"use strict";' + eol;
      expected += 'angular.module("rea.templates",[]).run(["$templateCache",function($templateCache){' + eol;
      expected += '}]);' + eol;
      expected += '})(window,document);';

      expect( templates ).toEqual( expected );

    });

  });

  describe('private: find()', function() {
    it('should ensure that this.patterns is preserved', function() {
      var file = '/theme1/file1.html';
      stubs['glob-all'].sync.andReturn( [file] );

      uut.add( file );
      expect( uut.patterns ).toEqual([ file ]);
      uut.stringify();

      expect( stubs['glob-all'].sync ).toHaveBeenCalledWith([ file]);
      expect( uut.patterns ).toEqual([ file ]);
    });
  });

  describe('unique()', function() {

     it('should have this function', function() {
      expect( uut.unique ).toBeDefined();
    });

    it('should return the class', function() {
      expect( uut.unique() ).toEqual( uut );
    });

    it('should make it possible to create an overlay', function() {
      var files = ['/theme1/file1.html', '/theme2/file1.html'];
      stubs['glob-all'].sync.andReturn( files );

      uut.unique(function( path ) {
        return path.replace(/\/theme[0-9]{1}\//, '');
      }).stringify();

      expect( uut.files ).toEqual({ 'file1.html': '/theme1/file1.html' });
    });

    it('should make it possible to create an overlay from folders', function() {
      var folder = {
        'overlay': '/theme-overlay/file.html',
        'normal':  '/theme/file.html'
      };

      stubs['glob-all'].sync.reset();
      stubs['glob-all'].sync.andCallFake(function( list ) {
        return [ folder.overlay, folder.normal ];
      });

      uut.folder( folder.overlay )
         .folder( folder.normal )
         .unique(function( file ) {
           return file.replace(/theme-overlay/, 'theme');
         })
         .stringify();

      expect( uut.files ).toEqual({ '/theme/file.html': '/theme-overlay/file.html' });
    });

    it('should not expect glob to return sorted list', function() {
       var folder = {
        'overlay': '/theme-overlay/file.html',
        'normal':  '/theme/file.html'
      };

      stubs['glob-all'].sync.reset();
      stubs['glob-all'].sync.andCallFake(function( list ) {
        // return files in WRONG order
        // module has to handle this
        return [ folder.normal, folder.overlay ];
      });

      uut.folder( folder.overlay )
         .folder( folder.normal )
         .unique(function( file ) {
           return file.replace(/theme-overlay/, 'theme');
         })
         .stringify();

      expect( uut.files ).toEqual({ '/theme/file.html': '/theme-overlay/file.html' });
    });

  });

  describe('stream()', function() {

    it('should return a stream', function() {

      stubs.fs.readFileSync.reset();

      var files = ['file1', 'file2'];

      stubs['glob-all'].sync.andReturn( files );
      stubs.fs.readFileSync.andCallFake(function( file ) {
        return '<some>template for ' + file + '</some>';
      });

      var stream = uut.stream();
      expect( stream.on ).toBeDefined();
      expect( stream ).toEqual( jasmine.any( Readable ));
    });

  });

});
