module.exports = function(grunt) {
  grunt.initConfig({
    eslint: {
      target: ['lib/*.js']
    },
    browserify: {
      dev: {
        src: ['lib/exports.js'],
        dest: 'dist/appeer.js'
      }
    },
    uglify: {
      prod: {
        options: { mangle: true, compress: true },
        src: 'dist/appeer.js',
        dest: 'dist/appeer.min.js'
      }
    },
    watch: {
      scripts: {
        files: ['lib/*.js'],
        tasks: ['eslint', 'browserify'],
        options: {
          spawn: false
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-eslint');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.registerTask('default', ['eslint', 'browserify', 'uglify', 'watch']);
};
