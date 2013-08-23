/**
Example gruntfile for Sweet
*/

module.exports = function(grunt) {
	require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

	// Project configuration
	grunt.initConfig({
		sweet: {
			content_dir: 'content',
			publish_dir: 'htdocs',
			templates_dir: 'templates',
			dot_html: true
		},
		watch: {
			sweet: {
				files: [
					'<%= sweet.content_dir %>/**',
					'<%= sweet.templates_dir %>/**'
				],
				tasks: 'sweet'
			}
		},
		connect: {
			web: {
				options: {
					port: 8000,
					base: '<config:sweet.publish_dir>'
				}
			}
		}
	});

	// Project tasks
	grunt.registerTask('default', ['sweet']);
	grunt.registerTask('serve', ['connect', 'watch']);
};
