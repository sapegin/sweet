var path = require('path');
module.exports = {
	CONTENT_DIR: path.join(__dirname, 'content/'),
	PUBLISH_DIR: path.join(__dirname, 'htdocs/'),
	TEMPLATES_DIR: path.join(__dirname, 'templates/'),
	DEFAULT_TEMPLATE_ID: 'page',
	URL_PREFIXES: {
		ru: 'http://sapegin.ru/',
		en: 'http://sapegin.me/'
	},
	URI_PREFIXES: {
		ru: '/',
		en: '/'
	},
	FILES: {
	}
};
