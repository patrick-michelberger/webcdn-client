module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        connect: {
            server: {
                base: '/',
                keepalive: true,
                port: 80,
                hostname: '*'
            }
        },
        jshint: {
            files: ['Gruntfile.js', 'src/**.js', '!src/js/lib/**', '!src/js/require*.js'],
            options: {
                curly: true,
                eqeqeq: true,
                immed: true,
                latedef: true,
                newcap: true,
                noarg: true,
                sub: true,
                undef: true,
                boss: true,
                eqnull: true,
                browser: true,

                globals: {
                    // AMD
                    module: true,
                    require: true,
                    requirejs: true,
                    define: true,

                    // Environments
                    console: true,
                    logger: true,
                    process: true,
                    self: true,

                    // Testing
                    sinon: true,
                    describe: true,
                    it: true,
                    expect: true,
                    beforeEach: true,
                    afterEach: true
                }
            }
        },

        copy: {
            build: {
                cwd: 'src',
                src: ['**'],
                dest: 'dist',
                expand: true
            },
        },

        clean: {
            build: {
                src: ['dist']
            },
            scripts: {
                src: ['dist/**/*.js', '!dist/webcdn.min.js']
            }
        },

        uglify: {
            build: {
                options: {
                    mangle: false
                },
                files: {
                    'dist/webcdn.min.js': ['dist/**/*.js']
                }
            }
        },

        watch: {
            scripts: {
                files: ['src/**/*.js'],
                tasks: ['build']
            },
            copy: {
                files: ['/src/**'],
                tasks: ['copy']
            }
        },

        mocha: {
            test: {
                src: ['tests/**/*.html']
            },
            options: {
                run: true
            }
        },

        blanket_mocha: {
            options: {
                run: true,
                reporter: 'Min',
                // We want a minimum of 70% coverage
                threshold: 70
            },
            files: {
                src: 'tests/*.html'
            }
        },

        browserify: {
            main: {
                src: 'src/webcdn.js',
                dest: 'dist/webcdn.js'
            }
        },

        jsdoc: {
            dist: {
                src: ['src/**/*.js', 'test/*.js'],
                options: {
                    destination: 'doc'
                }
            }
        }

    });

    // Load NPM Tasks
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-jsdoc');
    grunt.loadNpmTasks('grunt-blanket-mocha');
    grunt.loadNpmTasks('grunt-mocha');
    grunt.loadNpmTasks('grunt-browserify');

    // Define Tasks
    grunt.registerTask('default', ['scripts', 'connect', 'watch']);
    grunt.registerTask('doc', ['jsdoc']);
    grunt.registerTask('test', ['mocha']);
    grunt.registerTask('scripts', ['browserify', 'uglify']);
    grunt.registerTask('build', ['clean:build', 'copy', 'scripts', 'mocha']);
};
