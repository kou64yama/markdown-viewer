import fs from 'fs';
import gulp from 'gulp';
import gulpLoadPlugins from 'gulp-load-plugins';
import watchify from 'watchify';
import browserify from 'browserify';
import babelify from 'babelify';
import source from 'vinyl-source-stream';
import buffer from 'vinyl-buffer';
import merge from 'merge2';
import semver from 'semver';
import del from 'del';
import assign from 'lodash.assign';

const $ = gulpLoadPlugins();
const reload = $.livereload.reload;


function readJSON(filename) {
  return JSON.parse(fs.readFileSync(filename, 'utf8'));
};


function build(entries, outfile, options) {
    const bundler = browserify(assign({}, watchify.args, {
        entries: entries,
        debug: true
    })).transform(babelify);
    if (options && options.watch) {
        bundler.plugin(watchify);
    }

    const path = outfile.split('/');
    const filename = path.pop();
    const dir = path.join('/');

    function bundle() {
        return bundler.bundle()
            .on('error', $.util.log.bind($.util, 'Browserify Error'))
            .pipe(source(filename))
            .pipe(buffer())
            .pipe(gulp.dest(dir));
    }

    bundler.on('log', $.util.log);
    bundler.on('update', bundle);
    return bundle();
}

gulp.task('templates', () => {
    return gulp.src('app/templates/**/*.hbs')
        .pipe($.handlebars())
        .pipe($.defineModule('commonjs'))
        .pipe(gulp.dest('app/templates'));
});

gulp.task('scripts', ['templates'], () => {
    return merge([
        build(['app/scripts.babel/chromereload.js'], 'app/scripts/chromereload.js'),
        build(['app/scripts.babel/injected.js'], 'app/scripts/injected.js')
    ]);
});

gulp.task('styles', () => {
    return gulp.src('app/styles.stylus/injected.styl')
        .pipe($.sourcemaps.init())
        .pipe($.stylus())
        .pipe($.sourcemaps.write())
        .pipe(gulp.dest('app/styles'));
});

gulp.task('extras', () => {
    return gulp.src([
        'app/**/*',
        '!app/manifest.json',
        '!app/{scripts,styles}/**/*'
    ]).pipe(gulp.dest('dist'));
});

gulp.task('bump', () => {
    const pkg = readJSON('./package.json');
    const version = semver.inc(pkg.version, 'patch');

    return merge([
        gulp.src('package.json')
            .pipe($.bump({version: version}))
            .pipe(gulp.dest('./')),
        gulp.src('app/manifest.json')
            .pipe($.bump({version: version}))
            .pipe(gulp.dest('app'))
    ]);
});

gulp.task('manifest', ['styles', 'scripts'], () => {
    return gulp.src('app/manifest.json')
        .pipe($.chromeManifest({
            background: {
                target: 'scripts/background.js',
                exclude: ['scripts/chromereload.js']
            }
        }))
        .pipe($.if('*.json', $.jsonminify()))
        .pipe($.if('*.js', $.uglify()))
        .pipe($.if('*.css', $.minifyCss({compatibility: '*'})))
        .pipe(gulp.dest('dist'));
});

gulp.task('clean', del.bind(null, [
    'dist',
    'app/scripts/*.js',
    'app/styles/*.css',
    '!app/scripts.babel/*.js'
]));

gulp.task('debug', ['scripts', 'styles'], () => {
    $.livereload.listen();

    gulp.watch([
        'app/**/*',
        '!app/scripts.babel/*.js',
        '!app/styles.stylus/*.styl'
    ]).on('change', reload);

    build(['app/scripts.babel/chromereload.js'], 'app/scripts/chromereload.js', {watch: true}),
    build(['app/scripts.babel/injected.js'], 'app/scripts/injected.js', {watch: true});
    gulp.watch('app/styles.stylus/**/*.styl', ['styles']);
    gulp.watch('app/templates/**/*.hbs', ['templates']);
});

gulp.task('build', ['manifest', 'extras'], () => {
    const pkg = readJSON('./package.json');

    return gulp.src('dist/**/*')
        .pipe($.zip(pkg.name + '-' + pkg.version + '.zip'))
        .pipe($.size({title: 'build'}))
        .pipe(gulp.dest('build'));
});

gulp.task('release', ['clean', 'bump'], () => {
    gulp.start('build');
});

gulp.task('default', ['clean'], () => {
    gulp.start('build');
});
