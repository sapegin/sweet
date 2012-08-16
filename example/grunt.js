/**
Example gruntfile for Sweet
*/

module.exports = function(grunt) {
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
		server: {
			port: 8000,
			base: '<config:sweet.publish_dir>'
		}
	});

	grunt.loadNpmTasks('grunt-sweet');

	// Project tasks
	grunt.registerTask('default', 'sweet');
	grunt.registerTask('serve', 'server watch');
};
