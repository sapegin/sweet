#!/usr/bin/env node

/**
 * Sweet
 * Simplest Web Engine Ever, The
 *
 * @author Artem Sapegin
 * @copyright 2011 Artem Sapegin (sapegin.ru)
 * @license http://creativecommons.org/licenses/by/3.0/
 */


var fs = require('fs'),
	path = require('path'),
	optparse = require('optparse'),
	fest = require('fest'),
	stylus = require('stylus');


// Config
try {
	var o = require(path.join(process.cwd(), 'sweet-config.js'));
}
catch (e) {
	error('Cannot open configuration file sweet-config.js.');
}


// Global vars
var compiledTemplates = {};


// Command line options
var switches = [
    ['-h', '--help', 'Shows this screen'],
    ['-w', '--watch', 'Watch styles for changes']
];
var parser = new optparse.OptionParser(switches),
	isBuild = true;

parser.on('help', function() {
	console.log(parser.toString());
	isBuild = false;
});

parser.on('watch', function() {
	watch();
	isBuild = false;
});

parser.parse(process.argv);


// Run Forrest run!
if (isBuild) build();


function build(recompile) {
	var recompile = recompile !== false,
		datasets = {},
		sitemap = {},
		commons = {},
		templates = {},
		versions = {};

	var files = getFilesList(o.CONTENT_DIR);
	for (var fileIdx = 0; fileIdx < files.length; fileIdx++) {
		var srcPath = files[fileIdx],
			lang = getFileLanguage(srcPath),
			fileId = lang + '/' + getFileSignificantPath(srcPath);
			resultPath = path.join(o.PUBLISH_DIR, fileId + '.html');

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
		if (data.template && (recompile || (!recompile && !compiledTemplates[data.template]))) {
			templates[data.template] = true;
		}
		else {
			data.template = o.DEFAULT_TEMPLATE_ID;
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
	if (o.FILES) {
		for (var id in o.FILES) {
			var file = o.FILES[id];
			if (!path.existsSync(file[0])) {
				error('Versioned file ' + file[0] + ' not found');
			}
			versions[id] = file[1].replace('{version}', fs.statSync(file.path).mtime.getTime());
		}
	}

	if (recompile) {
		templates[o.DEFAULT_TEMPLATE_ID] = true;
	}
	compileTemplates(templates);
	generateFiles(datasets, sitemap, commons, versions);
}

function watch() {
	console.log('\033[90mWatching\033[0m...');
	watchTemplatesAndContent();
	watchStylesheets();
}

function watchTemplatesAndContent() {
	build();
	watchFolder(o.CONTENT_DIR, function() {
		build(false);
	});
	watchFolder(o.TEMPLATES_DIR, build);
}

function watchStylesheets() {
	if (!o.STYLESHEETS || !o.STYLESHEETS_DIR) {
		return;
	}

	// Create CSS files first time
	for (var ssIdx = 0; ssIdx < o.STYLESHEETS.length; ssIdx++) {
		var ss = o.STYLESHEETS[ssIdx];
		stylusBuild(ss[0], ss[1]);
	}

	watchFolder(o.STYLESHEETS_DIR, updateStylesheets);
}

function watchFolder(dir, callback) {
	var prevStats;
	fs.watch(dir, function(event, filename) {
		if (!filename) return;

		// Prevent multiple recompiling
		var stats = fs.statSync(path.join(dir, filename));
		if (prevStats &&
			(stats.size === prevStats.size && stats.mtime.getTime() === prevStats.mtime.getTime())) {
			return;
		}
		prevStats = stats;

		console.log('\033[90mChanges detected\033[0m in %s', filename);
		callback();
	});
}

function updateStylesheets() {
	for (var ssIdx = 0; ssIdx < o.STYLESHEETS.length; ssIdx++) {
		var ss = o.STYLESHEETS[ssIdx];
		stylusBuild(ss[0], ss[1]);
	}
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
		var templatePath = path.join(o.TEMPLATES_DIR, templateId + '.xhtml');
		if (!path.existsSync(templatePath)) {
			error('Template file ' + templatePath + ' not found.');
			return;
		}
		fest.compile(templatePath).then(function(template) {
			compiledTemplates[templateId] = template;
		});
	}
}

function fileToUrl(filepath) {
	return o.URL_PREFIXES[getFileLanguage(filepath)] + getFileUriPart(filepath);
}

function fileToUri(filepath) {
	return o.URI_PREFIXES[getFileLanguage(filepath)] + getFileUriPart(filepath);
}

function getFileUriPart(filepath) {
	return getFileSignificantPath(filepath).replace(/^index$/, '/');
}

function getFileSignificantPath(filepath) {
	var basename = path.basename(filepath).replace(path.extname(filepath), '');
	filepath = filepath.replace(path.join(o.CONTENT_DIR, getFileLanguage(filepath)), '');
	filepath = filepath.slice(1);
	filepath = path.dirname(filepath);
	return path.join(filepath, basename).replace('\\', '/');
}

function getFileLanguage(filepath) {
	return path.basename(path.dirname(filepath));
}

function generateFiles(filesData, sitemap, commons, versions) {
	for (var fileId in filesData) {
		var data = filesData[fileId];

		// Special data
		data.map = sitemap;
		data.files = versions;
		for (var key in commons) {
			data[key] = commons[key];
		}

		transform(data.template, data, function(result) {
			var resultPath = path.join(o.PUBLISH_DIR, fileId + '.html');
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
	console.error('\033[31m%s\033[0m', message);
	process.exit(1);
}

function transform(templateId, json, callback) {
	var template = (new Function('return ' + compiledTemplates[templateId]))();
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
	//styl = stylusPreprocess(styl);
	var options = o.STYLUS_OPTIONS || {
		compress: false
	};

	stylus(styl)
		.set('filename', stylpath)
		.set('compress', options.compress)
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
