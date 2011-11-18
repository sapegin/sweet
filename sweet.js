/**
 * Sweet
 * Simplest Web Engine Ever, The
 *
 * @version 0.1
 * @requires Node.js, Fest
 * @author Artem Sapegin
 * @copyright 2011 Artem Sapegin (sapegin.ru)
 * @license http://creativecommons.org/licenses/by/3.0/
 */

/*
@todo
+ Поиск новых документов
* Сохранение таймстемпа шаблонов
- Зависимости файлов контента
+ Контент в JSON
+ JSON со свойствами всех файлов контента
+ Сохранение его в файл
+ Проверить работу с вложенными папками
+ Генерация урлов
+ Мультиязычность блеать
* Подумать, как это скрестить с минификатором/склейщиком js/css
+ Общие данные
- Вынести настройки в отдельный файл
- Изменения в общих файлах
*/



/**
 * Settings
 */
var CONTENT_DIR = 'content/',
	PUBLISH_DIR = 'htdocs/',
	TEMPLATES_DIR = 'templates/',
	DATA_DIR = 'data/',
	DEFAULT_TEMPLATE = 'page.xml',
	URL_PREFIXES = {
		ru: 'http://sapegin.ru/',
		en: 'http://sapegin.me/'
	},
	URI_PREFIXES = {
		ru: '/',
		en: '/'
	};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

var fs = require('fs'),
	path = require('path'),
	fest = require('./lib/fest/fest');


// Run Forrest run!
build();


function build() {
	var files = findSync(CONTENT_DIR.slice(0, -1)),
		filesData = {},
		templatesChanged = isTemplatesChanged(),
		sitemapFile = DATA_DIR + 'sitemap',
		sitemap = {},
		commons = {};

	if (path.existsSync(sitemapFile)) {
		sitemap = readJsonFile(sitemapFile);
	}

	for (var fileIdx = 0; fileIdx < files.length; fileIdx++) {
		var srcPath = files[fileIdx];
		if (fs.statSync(srcPath).isDirectory()) continue;

		var file = srcPath.replace(CONTENT_DIR, ''),
			resultPath = PUBLISH_DIR + replaceFileExtension(file, 'html');

		// Skip unmodified files
		if (!templatesChanged && path.existsSync(resultPath) &&
			fs.statSync(srcPath).mtime <= fs.statSync(resultPath).mtime) continue;

		// Read contents
		var data = getContent(srcPath);
		if (data.error) {
			console.log('Parse error in content file ' + srcPath + ':\n' + data.error);
			return;
		}

		// Common data file?
		if (srcPath.indexOf(CONTENT_DIR + '.') === 0) {
			commons[srcPath.substring(CONTENT_DIR.length + 1, srcPath.lastIndexOf('.'))] = data;
			continue;
		}

		// Check template
		if (data.template) {
			var templatePath = TEMPLATES_DIR + data.template + '.xml';
			if (path.existsSync(templatePath)) {
				data.template = templatePath;
			}
			else {
				console.log('Template file ' + templatePath + ' not found.');
				return;
			}
		}
		else {
			data.template = TEMPLATES_DIR + DEFAULT_TEMPLATE;
		}

		var lang = getFileLanguage(srcPath),
			id = lang + '/' + getFileSignificantPath(srcPath);

		// Additional data
		data.lang = lang;
		data.path = id;
		data.url = fileToUrl(srcPath);
		data.uri = fileToUri(srcPath);
		
		// Sitemap
		sitemap[id] = getSitemapData(data);

		filesData[file] = data;
	}

	fs.writeFile(sitemapFile, JSON.stringify(sitemap), function(error) {
		if (error) {
			console.log('Cannot write file ' + sitemapFile + '.');
		}
	});

	generateFiles(filesData, sitemap, commons);
}


function isTemplatesChanged() {
	var timestampFile = DATA_DIR + 'templates-timestamp',
		files = fs.readdirSync(TEMPLATES_DIR);

	if (!path.existsSync(timestampFile)) {
		updateTemplatesTimestamp(timestampFile);
		return true;
	}

	var timestamp = fs.statSync(timestampFile).mtime;
	for (var fileIdx = 0; fileIdx < files.length; fileIdx++) {
		var templatePath = TEMPLATES_DIR + files[fileIdx],
			templateMtime = fs.statSync(templatePath).mtime;
		if (templateMtime > timestamp) {
			updateTemplatesTimestamp(timestampFile);
			return true;
		}
	}

	return false;
}


function updateTemplatesTimestamp(timestampFile) {
	fs.writeFile(timestampFile, '', function(error) {
		if (error) {
			console.log('Cannot write file ' + timestampFile + '.');
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

function fileToUrl(filepath) {
	return URL_PREFIXES[getFileLanguage(filepath)] + getFileSignificantPath(filepath);
}

function fileToUri(filepath) {
	return URI_PREFIXES[getFileLanguage(filepath)] + getFileSignificantPath(filepath);
}

function getFileSignificantPath(filepath) {
	filepath = filepath.replace(CONTENT_DIR, '');
	return filepath.substring(filepath.indexOf('/') + 1, filepath.lastIndexOf('.'))
}

function getFileLanguage(filepath) {
	filepath = filepath.replace(CONTENT_DIR, '');
	return filepath.substring(0, filepath.indexOf('/'));
}

function getFileExtension(filepath) {
	return filepath.substring(filepath.lastIndexOf('.') + 1);
}

function getFileDir(filepath) {
	return filepath.substring(0, filepath.lastIndexOf('/'))
}

function replaceFileExtension(filepath, nexExt) {
	return filepath.replace('.' + getFileExtension(filepath), '.' + nexExt)
}

function generateFiles(filesData, sitemap, commons) {
	for (var file in filesData) {
		var data = filesData[file],
			resultPath = PUBLISH_DIR + replaceFileExtension(file, 'html');

		// Special data
		data.map = sitemap;
		for (var key in commons) {
			data[key] = commons[key];
		}

		transform(data.template, data, function(result) {
			mkdirSyncRecursive(getFileDir(resultPath));
			fs.writeFile(resultPath, result, function(error) {
				if (error) {
					console.log('Cannot write file ' + resultPath + '.');
				}
			});
		});
	}
}


function getContent(file) {
	var content = readUtfFile(file),
		ext = getFileExtension(file);
	
	if (ext === 'js' || ext === 'json') {
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
	console.log(message);
	process.exit(1);
}

function transform(file, json, callback) {
	fest.compile(file).then(function(template) {
		fest.transform(template, json).then(function(result) {
			callback(result);
		});
	});
}

// https://github.com/ryanmcgrath/wrench-js/blob/master/lib/wrench.js
function mkdirSyncRecursive(path, mode) {
	var self = this;

	try {
		fs.mkdirSync(path, mode);
	} catch(err) {
		if(err.code == "ENOENT") {
			var slashIdx = path.lastIndexOf("/");
			if(slashIdx > 0) {
				var parentPath = path.substring(0, slashIdx);
				mkdirSyncRecursive(parentPath, mode);
				mkdirSyncRecursive(path, mode);
			} else {
				throw err;
			}
		} else if(err.code == "EEXIST") {
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
        var p = dir + '/' + file;
        var stat = fs.statSync(p);
        if (cb) cb(p, stat);
        files.push(p);
        
        if (stat.isDirectory()) {
            files.push.apply(files, findSync(p, cb));
        }
        
        return files;
    }, []);
}
