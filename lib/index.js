/**
 * Sweet
 * Simplest Web Engine Ever, The
 *
 * @author Artem Sapegin
 * @copyright 2012 Artem Sapegin (sapegin.me)
 * @license MIT
 */


var fs = require('fs'),
	path = require('path'),
	fest = require('fest'),
	richtypo = require('richtypo'),
	marked = require('marked');

var ignore = [
	'.DS_Store'
];

function Sweet(o, done) {
	this.init(o, done);
}

Sweet.prototype = {
	init: function(o, done) {
		try {
			o = this.normalizeOptions(o);
		}
		catch (e) {
			this.error(e.message);
		}

		this.applyOptions(o);

		this.done = done;
		this.datasets = {};
		this.sitemap = {};
		this.commons = {};
		this.templates = {};
		this.templates[this.defaultTemplateId] = true;
		this.compiledTemplates = {};
		this.versions = {};
		this.filesToProcess = 0;

		this.prepareContent();
		this.prepareVersionedFiles();
		this.compileTemplates();
		this.generateFiles();
	},

	normalizeOptions: function(o) {
		var keyNotFound = function(key) {
			throw new Error('Required config variable ' + key + ' not found.');
		};

		if (o._normalized) return o;

		var optionsList = ['content_dir', 'publish_dir', 'templates_dir'];

		// Check required options and normalize paths
		optionsList.forEach(function(key) {
			if (!o[key]) keyNotFound(key);
			o[key] = normalizePath(o[key]);
		});

		o.files = o.files || {};
		for (var key in o.files) {
			var file = o.files[key];
			if (!file.path) keyNotFound(key + '.path');
			if (!file.href) keyNotFound(key + '.href');
			file.path = normalizePath(file.path);
		}

		// Default options

		if (!o.lang && !o.langs) o.lang = 'en';
		if (!o.default_template_id) o.default_template_id = 'template';
		if (!o.uri_prefixes) o.uri_prefixes = '/';
		if (!o.url_prefixes) o.url_prefixes = '/';
		if (o.debug === undefined) o.debug = false;
		if (o.typographer === undefined) o.typographer = true;
		o.dot_html = o.dot_html || o.debug;

		o._normalized = true;
		return o;
	},

	applyOptions: function(o) {
		var camelRe = /_([a-z])/g,
			camel = function(s) { return key.replace(camelRe, function(m, letter) { return letter.toUpperCase(); }); };
		for (var key in o) {
			this[camel(key)] = o[key];
		}
	},

	prepareContent: function() {
		var contentFiles = getFilesList(this.contentDir);
		this.filesToProcess = contentFiles.length;
		for (var contentIdx = 0, contentCnt = this.filesToProcess; contentIdx < contentCnt; contentIdx++) {
			var srcPath = contentFiles[contentIdx],
				lang = this.getFileLanguage(srcPath),
				fileId = (lang ? lang + '/' : '') + this.getFileSignificantPath(srcPath);
				resultPath = path.join(this.publishDir, fileId + '.html'),
				filename = path.basename(srcPath),
				ext = path.extname(srcPath);

			// Skip some files
			if (ignore.indexOf(filename) !== -1) {
				this.filesToProcess--;
				continue;
			}

			// Read contents
			var data;
			try {
				data = this.getContent(srcPath);
			}
			catch (e) {
				this.error('Parse error in content file ' + srcPath + ':\n' + e.message);
			}

			// Common data file?
			if (filename.charAt(0) === '.' && (ext === '.js' || ext === '.json')) {
				this.commons[filename.slice(1).replace(ext, '')] = data;
				this.filesToProcess--;
				continue;
			}

			// Check template
			if (data.template) {
				this.templates[data.template] = true;
			}
			else {
				data.template = this.defaultTemplateId;
			}

			// Additional data
			data.lang = lang || this.lang;
			data.path = fileId;
			data.url = this.fileToUrl(srcPath);
			data.uri = this.fileToUri(srcPath);

			this.sitemap[fileId] = this.getSitemapData(data);
			this.datasets[fileId] = data;
		}
	},

	prepareVersionedFiles: function() {
		if (this.files) {
			for (var versionedId in this.files) {
				var file = this.files[versionedId];
				if (!fs.existsSync(file.path)) {
					this.error('Versioned file ' + file.path + ' not found');
				}
				this.versions[versionedId] = file.href.replace('{version}', this.getFileVersion(file.path));
			}
		}
	},

	compileTemplates: function() {
		for (var templateId in this.templates) {
			var templatePath = path.join(this.templatesDir, templateId + '.xhtml');
			if (!fs.existsSync(templatePath)) {
				this.error('Template file ' + templatePath + ' not found.');
			}

			var compiled = fest.compile(toUnixPath(templatePath), {beautify: !this.debug});
			this.compiledTemplates[templateId] = (new Function('return ' + compiled))();
		}
	},

	generateFiles: function() {
		var datasets = this.datasets,
			commons = this.commons;

		for (var fileId in datasets) {
			var dataset = datasets[fileId];

			// Special data
			dataset.map = this.sitemap;
			dataset.files = this.versions;
			dataset.debug = this.debug;
			for (var key in commons) {
				dataset[key] = commons[key];
			}

			// Typography
			richtypo.lang(dataset.lang);
			dataset.pageTitle = dataset.title;
			if (this.typographer !== false) {
				if (dataset.title)
					dataset.title = richtypo.title(dataset.title);
				if (dataset.content)
					dataset.content = richtypo.rich(dataset.content);
			}

			// Expose typographer to templates
			dataset.t = richtypo.rich;
			dataset.tt = richtypo.title;
			dataset.tl = richtypo.lite;

			// Expose Markdown parser to templates
			dataset.md = marked;
			dataset.mds = markedString;

			this.transform(dataset.template, fileId, dataset, this.saveContentFile.bind(this));
		}
	},

	transform: function(templateId, fileId, json, callback) {
		var template = this.compiledTemplates[templateId];
		if (!template) {
			this.error('Template ' + templateId + ' is not invokable.');
		}
		process.nextTick(function() {
			callback(template(json), fileId);
		});
	},

	saveContentFile: function(result, fileId) {
		var resultPath = path.join(this.publishDir, fileId + '.html');
		mkdirSyncRecursive(path.dirname(resultPath));
		fs.writeFile(resultPath, result, (function(err) {
			if (err) {
				this.error('Cannot write file ' + resultPath + '.');
			}

			this.filesToProcess--;
			if (!this.filesToProcess) {
				this.done();
			}
		}).bind(this));
	},

	error: function(message) {
		this.done(message);
	},

	getFileLanguage: function(filepath) {
		if (!this.langs) return null;

		var relative = filepath.replace(this.contentDir, '');
		if (!relative) return null;

		var lang = relative.slice(1, 3);
		if (this.langs.indexOf(lang) === -1) return null;

		return lang;
	},

	getFileSignificantPath: function(filepath) {
		var basename = path.basename(filepath).replace(path.extname(filepath), '');
		filepath = filepath
			.replace(path.join(this.contentDir, this.getFileLanguage(filepath)), '')
			.slice(1);
		filepath = path.dirname(filepath);
		return toUnixPath(path.join(filepath, basename));
	},

	getFileVersion: function(filepath) {
		return fs.statSync(filepath).mtime.getTime();
	},

	getContent: function(file) {
		var ext = path.extname(file);

		// JSON content
		if (ext === '.js' || ext === '.json') {
			return readJsonFile(file);
		}

		var content = readUtfFile(file);

		var parts = content.split('---'),
			head = '',
			body = '';
		if (parts.length === 2) {
			head = parts[0];
			body = parts[1];
		}
		else {
			head = content;
		}

		// Markdown content
		if (ext === '.md' || ext === '.markdown') {
			body = marked(body);
		}

		var result = { content: body.trim() };

		var headLines = head.split('\n');
		for (var lineIdx = 0; lineIdx < headLines.length; lineIdx++) {
			var line = headLines[lineIdx];
			if (line.indexOf(':') === -1) continue;

			var m = line.match(/^\W*(\w+?):\s*(.*)/);
			if (!m) throw new Error('Cannot understand variable on line ' + (lineIdx + 1) + ':\n' + line);

			var key = m[1],
				value = m[2].trim();

			result[key] = value;
		}

		return result;
	},

	getFileUriPart: function(filepath) {
		return this.getFileSignificantPath(filepath).replace(/^index$/, '');
	},

	getSitemapData: function(data) {
		var sitemapData = {};
		for (var key in data) {
			if (key !== 'content') {
				sitemapData[key] = data[key];
			}
		}
		return sitemapData;
	},

	fileToUrl: function(filepath) {
		return this.fileToLink(filepath, this.urlPrefixes);
	},

	fileToUri: function(filepath) {
		return this.fileToLink(filepath, this.uriPrefixes);
	},

	fileToLink: function(filepath, prefixes) {
		var link = this.getFileUriPart(filepath);
		if (this.dot_html && link !== '') link += '.html';
		if (prefixes) {
			return prefixes[this.langs ? this.getFileLanguage(filepath) : 0] + link;
		}
		else {
			return link;
		}
	}

};


/* Utils */

function normalizePath(filepath) {
	return path.join(process.cwd(), filepath);
}

function toUnixPath(filepath) {
	return filepath.replace(/\\/g, '/');
}

function getFilesList(dir) {
	var lastChar = dir.slice(-1);
	if (lastChar === '/' || lastChar === '\\') {
		dir = dir.slice(0, -1);
	}

	var items = findSync(dir),
		files = [];

	for (var itemIdx = 0; itemIdx < items.length; itemIdx++) {
		var item = items[itemIdx];
		if (!fs.statSync(item).isDirectory()) {
			files.push(path.normalize(item));
		}
	}

	return files;
}

function readJsonFile(filepath) {
	var data = readUtfFile(filepath);
	if (!data) return {};

	try {
		return JSON.parse(data);
	}
	catch (e) {
		throw new Error('Cannot parse JSON file ' + filepath + '.\n' + e);
	}
}

// Read UTF-8 file and remove BOM
function readUtfFile(filepath) {
	return fs.readFileSync(filepath, 'utf8').replace(/^\uFEFF/, '');
}

// https://github.com/substack/node-findit/blob/master/index.js
function findSync(dir, callback) {
	var rootStat = fs.statSync(dir);
	if (!rootStat.isDirectory()) {
		if (callback) callback(dir, rootStat);
		return [dir];
	}

	return fs.readdirSync(dir).reduce(function(files, file) {
		var p = path.join(dir, file),
			stat = fs.statSync(p);
		if (callback) callback(p, stat);
		files.push(p);

		if (stat.isDirectory()) {
			files.push.apply(files, findSync(p, callback));
		}

		return files;
	}, []);
}

// https://github.com/ryanmcgrath/wrench-js/blob/master/lib/wrench.js
function mkdirSyncRecursive(dir, mode) {
	try {
		fs.mkdirSync(dir, mode);
	}
	catch (err) {
		if (err.code === 'ENOENT') {
			mkdirSyncRecursive(path.dirname(dir), mode);
			mkdirSyncRecursive(dir, mode);
		}
		else if (err.code === 'EEXIST') {
			return;
		}
		else {
			throw err;
		}
	}
}

// Markdown
function markedString(text) {
	return marked(text)
		.replace(/^\s*<p>/, '')
		.replace(/<\/p>\s*$/, '');
}


/* API */

exports.compile = function(options, done) {
	process.nextTick(function() { new Sweet(options, done); });
};
