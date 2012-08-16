# Sweet: Simplest Web Engine Ever, The

Sweet is a very simple static websites generator powered by Node.js and designed to run as [Grunt](https://github.com/cowboy/grunt) task.


## Features

- HTML, Markdown or JSON content
- [Fest templates](https://github.com/mailru/fest)
- Multilingual content
- Typography helper (uses [Richtypo.js](https://github.com/sapegin/richtypo.js))
- Versioned files (adds timestamp to file URL to flush browser cache)
- Plus all Grunt features: JavaScript concatenation and minification, Stylus/SASS/LESS compilation, embedded web server and much more


## Installation

To use Sweet you need to install Grunt first:

```bash
$ npm install grunt -g
```

Then install Sweet Grunt task. `cd` to your project’s directory and type:

```bash
$ mkdir node_modules || npm install grunt-sweet
```

If you didn’t use Grunt before see the [Getting Started](https://github.com/cowboy/grunt/blob/master/docs/getting_started.md) to understand how it works.


## Example

Go to `example` folder, type `grunt serve` and point your browser to [http://127.0.0.1:8000/](http://127.0.0.1:8000/). Now you can edit any file and press F5 in browser to see changes you made.


## Configuration

Place `grunt.js` to your project’s root directory.

```js
module.exports = function(grunt) {
	grunt.initConfig({
		sweet: {
			content_dir: 'content',
			publish_dir: 'htdocs',
			templates_dir: 'templates'
		}
	});

	grunt.loadNpmTasks('grunt-sweet');
	grunt.registerTask('default', 'sweet');
};
```

This is the mininum required config file. Type `grunt` to run it.

See example gruntfile in `example/grunt.js` or [my homepage’s gruntfile](https://gist.github.com/3357685).

### Basic Options

Required parameters are:

```js
content_dir: 'content',
publish_dir: 'htdocs',
templates_dir: 'templates'
```

And optional are:

```js
default_template_id: 'template',  // 'template' by default
uri_prefixes: '/',  // '/' by default. Use it when your site located not in root directory
lang: 'en'  // 'en' by default
```

If your site is multilingual add this options (instead of `lang`):

```js
langs: ['ru', 'en'],
url_prefixes: {
	ru: 'http://sapegin.ru/',
	en: 'http://sapegin.me/'
},
uri_prefixes: {
	'ru': '/',
	'en': '/'
}
```

### Versioned files

```js
files: {
	css: {
		path: 'htdocs/build/styles.css',
		href: '/build/styles.css?{version}'
	},
	js: {
		path: 'htdocs/build/scripts.js',
		href: '/build/scripts.js?{version}'
	}
}
```

### Typographer

By default Sweet will apply [Richtypo.js](https://github.com/sapegin/richtypo.js) for `$.title` and `$.content`. To disable typographer add:

```js
typographer: false
```


## Using Templates

Sweet uses Fest templating engine (born at Mail.ru). See [docs](https://github.com/mailru/fest) (in Russian) in official repo or examples here.

### Content files

Content can be in HTML, Markdown of JSON. *HTML* files look like this:

```html
title: Page title
template: index
var1: any value
var2: another value

---

<p>Any HTML here.</p>
```

Only `title` is required. After `\n---\n` you can place any HTML and then use it in your templates as `$.content`. Add `template` to specify template (or value of `default_template_id` will be used).

Additionally you can add any options you want. For example, `var1` will be `$.var1` in your templates.

*Markdown* files are the same as HTML but file extension should be `.md` or `.markdown`. In content part you can use [GitHub flavored Markdown](http://github.github.com/github-flavored-markdown/) as well as any HTML.

*JSON* content is almost the same:

```json
{
	"title": "Page title",
	"template": "index",
	"var1": "any value",
	"var2": ["You", "can", "use", "all", "JSON", "power."]
}
```

### Template context

In addition to your own variables (see above) Sweet provides some useful template variables.

`$.title`

Page title.

`$.pageTitle`

Untypographed page title. When typographer is disabled (`"typographer": false` in config), `$.pageTitle` is equal to `$.title`.

`$.content`

Page content.

`$.debug`

True if debug mode is enabled (see `--debug` command line switch above).

`$.content`

Content of a page. See section *Content files* above.

`$.lang`

Language code (from `langs` config option).

`$.path`

Path of content file inside `content_dir` and without extension.

`$.uri` and `$.url`

URL and URI of a page: `uri_prefixes`/`url_prefixes` + `$.lang` + `$.path`.

`$.map`

Sitemap. Contexts of all pages (without `content`):

```json
{
	"index": {
		"title": "Home page",
		"path": "index",
		"uri": "/",
		...
	},
	"about": {
		"title": "About Us",
		"path": "about",
		"uri": "/about",
		...
	},
	...
}
```

`$.files`

Versioned files hash:

```json
{
	"css": "../styles/s.css?1329399548706"
}
```

### Template functions

You can use typographer and Markdown parser in your templates:

- `$.t()` — enhancing typography: non-breaking spaces, abbreviations.
- `$.tt()` — typography for big text: the same as rich + ampersands and hanging punctuation.
- `$.tl()` — simple typographer (quotes, em-dash, etc.) for user generated content (e.g. comments).
- `$.md()` — Markdown.
- `$.mds()` — Markdown (not wrapped in `<p>` tag).

In example: markdowned and typogrphed text from `myText` context variable.

```xml
<f:value>$.t($.md($.myText))</f:value>
```

### Common data

Any “hidden” JSON file (name begins with “.”) in `content_dir` interprets as file with common data.

For example `.common.json` with this contents:

```json
{
	"sitename": "Sweet Demo Site",
	"menu": [
		{
			"title": "Home",
			"href": "/"
		},
		{
			"title": "About",
			"href": "/about"
		}
	]
}
```

will be accessible via `$.common` context variable.


## How to Setup Development Environment

Add to your `grunt.js`:

```js
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
```

And:

grunt.registerTask('serve', 'server watch');

Then type `grunt serve` and point your browser to [http://127.0.0.1:8000/](http://127.0.0.1:8000/). Now you can edit any content file or template and press F5 in browser to see changes you made.


---

## License

The MIT License, see the included `License.md` file.
