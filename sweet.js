/**
 * Sweet
 * Simplest Web Engine Ever, The
 *
 * @version 0.3
 * @requires Node.js, Fest
 * @author Artem Sapegin
 * @copyright 2011 Artem Sapegin (sapegin.ru)
 * @license http://creativecommons.org/licenses/by/3.0/
 */

/*
@todo
+ Поиск новых документов
+ Контент в JSON
+ JSON со свойствами всех файлов контента
+ Сохранение его в файл
+ Проверить работу с вложенными папками
+ Генерация урлов
+ Мультиязычность блеать
* Подумать, как это скрестить с минификатором/склейщиком js/css
+ Общие данные
+ Вынести настройки в отдельный файл
+ Выкинуть все проверки на изменения
- Слежение за внешними файлами (js, css)
+ Предварительная компиляция шаблонов
- Вырезать class=""
- Типографика
- Нормальная проверка JSON на ошибки с указанием строки
+ Заменить кривые функции на http://nodejs.org/docs/v0.6.1/api/path.html
*/


var fs = require('fs'),
	path = require('path'),
	fest = require('./lib/fest/fest');

// Options
try {
	var o = require('../sweet-config.js');
}
catch (e) {
	error('Cannot open configuration file sweet-config.js.');
}


// Global vars
var compiledTemplates = {};


// Run Forrest run!
build();


function build() {
	var datasets = {},
		sitemap = {},
		commons = {},
		templates = {};

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
		if (srcPath.charAt(o.CONTENT_DIR.length) === '.') {
			commons[srcPath.substring(o.CONTENT_DIR.length + 1, srcPath.lastIndexOf('.'))] = data;
			continue;
		}

		// Check template
		if (data.template) {
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

	templates[o.DEFAULT_TEMPLATE_ID] = true;
	compileTemplates(templates);
	generateFiles(datasets, sitemap, commons);
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
	return o.URL_PREFIXES[getFileLanguage(filepath)] + getFileSignificantPath(filepath);
}

function fileToUri(filepath) {
	return o.URI_PREFIXES[getFileLanguage(filepath)] + getFileSignificantPath(filepath);
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

function generateFiles(filesData, sitemap, commons) {
	for (var fileId in filesData) {
		var data = filesData[fileId];

		// Special data
		data.map = sitemap;
		for (var key in commons) {
			data[key] = commons[key];
		}

		transform(data.template, data, function(result) {
			var resultPath = path.join(o.PUBLISH_DIR, fileId + '.html');
			mkdirSyncRecursive(path.dirname(resultPath));
			fs.writeFile(resultPath, result, function(error) {
				if (error) {
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
	console.log(message);
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
