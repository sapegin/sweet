#!/usr/bin/env node

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
	http = require('http'),
	url = require('url'),
	optparse = require('optparse'),
	fest = require('fest'),
	stylus = require('stylus'),
	jsp = require('uglify-js').parser,
	pro = require('uglify-js').uglify,
	colors = require('colors'),
	treewatcher = require('tree-watcher');


// Config
try {
	var o = JSON.parse(readUtfFile(path.join(process.cwd(), 'sweet.json')));
}
catch (err) {
	error('Cannot open configuration file sweet.json.\n' + err);
}

init();

// Global vars
var compiledTemplates = {},
	isDebug = false;


// Command line options
var parser = new optparse.OptionParser([
		['-h', '--help', 'Shows this screen'],
		['-d', '--debug', 'Debug mode'],
		['-w', '--watch', 'Watch for changes in content, templates and styles. (Implies --debug)'],
		['-s', '--serve', 'Serve website to localhost'],
		['-p', '--preview', '--serve --watch --debug']
	]),
	isBuild = true;

parser.on('help', function() {
	isBuild = false;
	console.log(parser.toString());
});

parser.on('debug', function() {
	isDebug = true;
});

parser.on('watch', function() {
	isDebug = true;
	watch();
});

parser.on('serve', function() {
	serve();
});

parser.on('preview', function() {
	isDebug = true;
	serve();
	watch();
});

parser.parse(process.argv);


// Run Forrest run!
if (isBuild) build();


function init() {
	// Check required options
	if (o.content_dir) {
		['publish_dir', 'templates_dir', 'default_template_id'].forEach(requireConfigVariable);
	}

	// Normalize all paths + some other checks
	['content_dir', 'publish_dir', 'templates_dir', 'stylesheets_dir'].forEach(normalizeConfigPath);

	['stylesheets', 'javascripts'].forEach(function(key) {
		if (o[key]) o[key].forEach(function(group, idx) {
			if (!group.in) error('Required config variable ' + key + '.' + idx + '.in not found.');
			if (!group.out) error('Required config variable ' + key + '.' + idx + '.out not found.');
			if (typeof group.in === 'object') {
				for (var idx in group.in) {
					group.in[idx] = normalizePath(group.in[idx]);
				}
			}
			else {
				group.in = normalizePath(group.in);
			}
			group.out = normalizePath(group.out);
		});
	});

	if (o.files) {
		for (var key in o.files) {
			if (!o.files[key].path) error('Required config variable files.' + key + '.path not found.');
			if (!o.files[key].href) error('Required config variable files.' + key + '.href not found.');
			o.files[key].path = normalizePath(o.files[key].path);
		};
	}
}

function requireConfigVariable(key) {
	if (!o[key]) error('Required config variable ' + key + ' not found.');
}

function normalizeConfigPath(key) {
	if (!o[key]) return;
	o[key] = normalizePath(o[key]);
}

function normalizePath(filepath) {
	return path.join(process.cwd(), filepath);
}

function build() {
	combineJavaScript();
	buildStylesheets();
	buildContent();
}

function buildContent(recompile) {
	if (!o.content_dir) return;

	var recompile = recompile !== false,
		datasets = {},
		sitemap = {},
		commons = {},
		templates = {},
		versions = {};

	var files = getFilesList(o.content_dir);
	for (var fileIdx = 0; fileIdx < files.length; fileIdx++) {
		var srcPath = files[fileIdx],
			lang = getFileLanguage(srcPath),
			fileId = (lang ? lang + '/' : '') + getFileSignificantPath(srcPath);
			resultPath = path.join(o.publish_dir, fileId + '.html');

		// Read contents
		var data = getContent(srcPath);
		if (data.error) {
			error('Parse error in content file ' + srcPath + ':\n' + data.error);
			return;
		}

		// Common data file?
		var filename = path.basename(srcPath),
			ext = path.extname(srcPath);
		if (filename.charAt(0) === '.' && (ext === '.js' || ext === '.json')) {
			commons[filename.slice(1).replace(ext, '')] = data;
			continue;
		}

		// Check template
		if (data.template) {
			if (recompile || (!recompile && !compiledTemplates[data.template])) {
				templates[data.template] = true;
			}
		}
		else {
			data.template = o.default_template_id;
		}

		// Additional data
		data.lang = lang;
		data.path = fileId;
		data.url = fileToUrl(srcPath);
		data.uri = fileToUri(srcPath);
		
		sitemap[fileId] = getSitemapData(data);
		datasets[fileId] = data;
	}

	// File versions
	if (o.files) {
		for (var id in o.files) {
			var file = o.files[id];
			if (!path.existsSync(file.path)) {
				error('Versioned file ' + file.path + ' not found');
			}
			versions[id] = file.href.replace('{version}', fs.statSync(file.path).mtime.getTime());
		}
	}

	// Combined JavaScripts
	var javascripts = [];
	if (isDebug && o.javascripts) {
		for (var groupIdx = 0; groupIdx < o.javascripts.length; groupIdx++) {
			var group = o.javascripts[groupIdx];
			for (var fileIdx = 0, filesCnt = group.in.length; fileIdx < filesCnt; fileIdx++) {
				javascripts.push(toUnixPath(group.in[fileIdx].replace(o.publish_dir, '')));
			}
		}
	}

	if (recompile) {
		templates[o.default_template_id] = true;
	}
	compileTemplates(templates);
	generateFiles({
		datasets: datasets,
		sitemap: sitemap,
		commons: commons,
		versions: versions,
		javascripts: javascripts 
	});
}

function watch() {
	console.log('Sweet watching...'.grey);
	watchTemplatesAndContent();
	watchStylesheets();
}

function serve(lang, port) {
	if (!lang && o.langs && o.langs.length) lang = o.langs[0];
	if (!port) port = 8000;
	var mimeTypes = {
		'default': 'text/plain',
		'.html': 'text/html',
		'.jpg': 'image/jpeg',
		'.png': 'image/png',
		'.js': 'text/javascript',
		'.css': 'text/css'
	};

	var server = http.createServer(function(req, res) {
		var uri = url.parse(req.url).pathname,
			filename;
		if (uri.indexOf('.') === -1) {  // Page
			filename = path.join(o.publish_dir, lang, (uri === '/' ? '/index' : uri) + '.html');
		}
		else {  // File
			filename = path.join(o.publish_dir, uri);
		}

		path.exists(filename, function(exists) {
			if (!exists) {
				console.log(colors.red('404: ' + uri));
				res.writeHead(404);
				res.end('404: Not found.');
				return;
			}

			console.log('200: ' + uri);
			var mimeType = mimeTypes[path.extname(filename)] || mimeTypes['default'];
			res.writeHead(200, {'Content-Type': mimeType});

			var fileStream = fs.createReadStream(filename);
			fileStream.pipe(res);
		});
	});

	server.on('error', function (e) {
		if (e.code === 'EADDRINUSE') {
			serve(lang, port + 1);
		}
		else {
			error('Error running server.\n' + e.code);
		}
	});

	server.on('listening', function () {
		console.log('Sweet is waiting for you at http://127.0.0.1:%s/', server.address().port);
	});

	server.listen(port);
}

function watchTemplatesAndContent() {
	buildContent();
	watchFolder(o.content_dir, function() {
		buildContent(false);
	});
	watchFolder(o.templates_dir, buildContent);
}

function watchStylesheets() {
	if (!o.stylesheets || !o.stylesheets_dir) {
		return;
	}

	buildStylesheets();

	watchFolder(o.stylesheets_dir, buildStylesheets);
}

function watchFolder(dir, callback) {
	var watcher = new treewatcher.Watcher({
		throttle: 50
	});

	watcher.on('change', function(event, path, watcher) {
		console.log('Changes detected in'.grey, colors.blue(path));
		callback();
	});

	watcher.watch(dir, function(err, watcher) {
		if (err) {
			error('Cannnot watch ' + dir)
		}
	});
}

function buildStylesheets() {
	if (!o.stylesheets) return;

	for (var ssIdx = 0; ssIdx < o.stylesheets.length; ssIdx++) {
		var ss = o.stylesheets[ssIdx];
		stylusBuild(ss.in, ss.out);
	}
}

function combineJavaScript() {
	if (!o.javascripts) return;

	for (var groupIdx = 0; groupIdx < o.javascripts.length; groupIdx++) {
		var group = o.javascripts[groupIdx];
		combine({
			in: group.in,
			out: group.out,
			glue: ';',
			filePreprocessor: function(contents) {
				return contents.replace(/^;+|;+$/g, '');
			},
			postprocessor: function(contents) {
				var ast = jsp.parse(contents);  // Parse code and get the initial AST
				ast = pro.ast_mangle(ast);  // Get a new AST with mangled names
				ast = pro.ast_squeeze(ast);  // Get an AST with compression optimizations
				return pro.gen_code(ast);
			}
		});
	}
}

function combine(options) {
	var inputFiles = options.in,
		resultFile = options.out,
		filePreprocessor = options.filePreprocessor,
		resultMtime = 0;
	if (path.existsSync(resultFile)) {
		resultMtime = fs.statSync(resultFile).mtime.getTime();
	}

	var updated = false,
		filesContent = [];
	for (var fileIdx = 0, filesCnt = inputFiles.length; fileIdx < filesCnt; fileIdx++) {
		var file = inputFiles[fileIdx];
		if (fs.statSync(file).mtime.getTime() > resultMtime) {
			updated = true;
		}
		
		var contents = readUtfFile(file);
		if (typeof filePreprocessor === 'function') { 
			contents = filePreprocessor(contents);
		}
		filesContent.push(contents);
	}

	if (!updated) return;

	var result = filesContent.join(options.glue || '');
	if (typeof options.postprocessor === 'function') {
		result = options.postprocessor(result);
	}

	// @todo extract to function saveFile()
	mkdirSyncRecursive(path.dirname(resultFile));
	fs.writeFile(resultFile, result, function(err) {
		if (err) {
			error('Cannot write file ' + resultFile + '.');
		}
	});
}

function getSitemapData(data) {
	var sitemapData = {};
	for (var key in data) {
		if (key !== 'content') {
			sitemapData[key] = data[key];
		}
	}
	return sitemapData;
}

function compileTemplates(templates) {
	for (var templateId in templates) {
		var templatePath = path.join(o.templates_dir, templateId + '.xhtml');
		if (!path.existsSync(templatePath)) {
			error('Template file ' + templatePath + ' not found.');
			return;
		}

		compiledTemplates[templateId] = (new Function('return ' + fest.compile(toUnixPath(templatePath))))();
	}
}

function toUnixPath(filepath) {
	return filepath.replace(/\\/g, '/');
}

function fileToUrl(filepath) {
	var url = getFileUriPart(filepath);
	if (o.url_prefixes) {
		return o.url_prefixes[getFileLanguage(filepath)] + url;
	}
	else {
		return url;
	}
}

function fileToUri(filepath) {
	var uri = getFileUriPart(filepath);
	if (o.uri_prefixes) {
		return o.uri_prefixes[getFileLanguage(filepath)] + uri;
	}
	else {
		return uri;
	}
}

function getFileUriPart(filepath) {
	return getFileSignificantPath(filepath).replace(/^index$/, '');
}

function getFileSignificantPath(filepath) {
	var basename = path.basename(filepath).replace(path.extname(filepath), '');
	filepath = filepath.replace(path.join(o.content_dir, getFileLanguage(filepath)), '');
	filepath = filepath.slice(1);
	filepath = path.dirname(filepath);
	return toUnixPath(path.join(filepath, basename));
}

function getFileLanguage(filepath) {
	if (!o.langs) return null;
	var relative = filepath.replace(o.content_dir, '');
	if (!relative) return null;
	var lang = relative.slice(1, 3);
	if (o.langs.indexOf(lang) === -1) return null;
	return lang;
}

function generateFiles(data) {
	var datasets = data.datasets,
		sitemap = data.sitemap,
		commons = data.commons,
		versions = data.versions,
		javascripts = data.javascripts;
		
	for (var fileId in datasets) {
		var data = datasets[fileId];

		// Special data
		data.map = sitemap;
		data.files = versions;
		data.javascripts = javascripts;
		data.debug = isDebug;
		for (var key in commons) {
			data[key] = commons[key];
		}

		transform(data.template, data, function(result) {
			var resultPath = path.join(o.publish_dir, fileId + '.html');
			mkdirSyncRecursive(path.dirname(resultPath));
			fs.writeFile(resultPath, result, function(err) {
				if (err) {
					error('Cannot write file ' + resultPath + '.');
				}
			});
		});
	}
}

function getContent(file) {
	var content = readUtfFile(file),
		ext = path.extname(file);
	
	if (ext === '.js' || ext === '.json') {
		return readJsonFile(file);
	}

	var parts = content.split('---');
	if (parts.length !== 2) return {error: 'Head/body delimiter (---) not found.'};

	var head = parts[0],
		body = parts[1],
		result = {content: body.trim()};

	var headLines = head.split('\n');
	for (var lineIdx = 0; lineIdx < headLines.length; lineIdx++) {
		var line = headLines[lineIdx];
		if (line.indexOf(':') === -1) continue;

		var m = line.match(/^\W*(\w+?):\s*(.*)/);
		if (!m) return {error: 'Cannot understand variable on line ' + (lineIdx + 1) + ':\n' + line};

		var key = m[1],
			value = m[2].trim();

		result[key] = value;
	}

	return result;
}

function getFilesList(dir) {
	var lastChar = dir.charAt(dir.length - 1);
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
		var json = JSON.parse(data);
	}
	catch (e) {
		error('Cannot parse JSON file ' + filepath + '.');
	}
	return json;
}

function readUtfFile(filepath) {
	var data = fs.readFileSync(filepath, 'utf8');
	return data.replace(/^\uFEFF/, '');
}

function error(message) {
	console.error('%s'.red, message);
	process.exit(1);
}

function transform(templateId, json, callback) {
	var template = compiledTemplates[templateId];
	if (!template) {
		error('Template ' + templateId + ' is not invokable.');
	}
	callback(template(json));
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
		} else if (err.code === 'EEXIST') {
			return;
		} else {
			throw err;
		}
	}
}

// https://github.com/substack/node-findit/blob/master/index.js
function findSync(dir, cb) {
	var rootStat = fs.statSync(dir);
	if (!rootStat.isDirectory()) {
		if (cb) cb(dir, rootStat);
		return [dir];
	}
	
	return fs.readdirSync(dir).reduce(function (files, file) {
		var p = path.join(dir, file);
		var stat = fs.statSync(p);
		if (cb) cb(p, stat);
		files.push(p);
		
		if (stat.isDirectory()) {
			files.push.apply(files, findSync(p, cb));
		}
		
		return files;
	}, []);
}


/* Stylus functions */

function stylusBuild(stylpath, csspath) {
	var styl = readUtfFile(stylpath);
	if (!styl) error('Cannot open stylesheet ' + stylpath + '.');

	stylus(styl)
		.set('filename', stylpath)
		.set('compress', isDebug)
		.set('include css', true)
		.render(function(err, css){
			if (err) error('Stylus error.' + '\n\n' + err.message || err.stack);

			fs.writeFile(csspath, css, function(err) {
				if (err) {
					error('Cannot write file ' + csspath + '.');
				}
			});
		});
}
