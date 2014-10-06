# partial2js

Compile angular.js partials to JavaScript angular modules. 

## features

* enables pre-loading of all partials in one js-file
* generates deploy-ready angular modules
* very flexible, supports 'overlays'
* rename templates in build process
* support streams

## tests

```js
npm test
```

## with gulp

```js
gulp.task('templates', function() {
 return partial2js()
  .folder('./path/to/theme1')
  .folder('./path/to/base-theme')
  .not( '*.dev.html' )
  .unique(function( path ) {
    return path.replace(/.*path\/to\/[a-z-0-9]*\/?/, 'partials/');
  })
  .stream('some.template.module')
  .pipe(source('templates.js'))
  .pipe(gulp.dest( './dist/js/' ))
});
```

