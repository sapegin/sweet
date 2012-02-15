# Sweet: Simplest Web Engine Ever, The

Sweet is a very simple static websites generator powered by Node.js. Contains template engine, JavaScript concatenator/minificator and Stylus support. (You can use only parts you need.)


## Features

  - JSON or HTML content
  - [Fest templates](https://github.com/mailru/fest)
  - JavaScript concatenation and minification (uses [UglifyJS](https://github.com/mishoo/UglifyJS))
  - [Stylus](https://github.com/LearnBoost/stylus) support (plain CSS not supported yet)
  - Embedded web server
  - Multilingual content
  - Automatic rebuilding when content, templates or styles are changed
  - Versioned files (to flush browser cache)


## Installation

```bash
$ npm install swe -g
```


## Example

Go to `example` folder, type `swe -p` and point your browser to http://127.0.0.1:8000/. Now you can edit any file and press F5 to see changes you made.


## Command line switches

```bash
$ sweit
```

Builds website.

`-d` or `--debug`

Debug mode. You can test for `$.debug` in your templates.

`-w` or `--watch`

Watch mode. Will rebuild website on any change in content, templates or styles.

`-s` or `--serve`

Builds and serves your website to localhost.

`-p` or `--preview`

`--serve` + `--watch` + `--debug`—the most convenient mode for development.


## Configuration

Place `sweet.json` to your project’s root directory.

The only required option is `publish_dir`—it is where your generated files will be placed. So minimal config is:

```json
{
	"publish_dir": "htdocs"
}
```

But it is of course useless :) You should add any of the following groups of options.

### Templates

Required options are:

```
"content_dir": "content",
"templates_dir": "templates",
"default_template_id": "page",
```

See *Working with templates* section below.

If your site is multilingual add this options:

```json
"langs": ["ru", "en"],
"url_prefixes": {
	"ru": "http://sapegin.ru/",
	"en": "http://sapegin.me/"
},
"uri_prefixes": {
	"ru": "/",
	"en": "/"
},
```

### JavaScript Files

To concatenate and minify some JavaScript:

```json
"javascripts": [
	{
		"in": [
			"js/test1.js",
			"js/test2.js",
			"js/test3.js"
		],
		"out": "js/test.min.js"
	}
],
```

### Versioned files

```json
"files": {
	"css": {
		"path": "htdocs/styles/s.css",
		"href": "../styles/s.css?{version}"
	}
}
```

### Stylus 

```json
"stylesheets": [
	{
		"in": "styles/index.styl",
		"out": "htdocs/styles/s.css"
	}
],
```

## Working with templates

Sweet uses Fest templating engine (born in Mail.ru). See docs (in Russian) in official repo or examples here.

### Content files

Content can be both JSON or HTML. HTML files look like this:

```html
title: Page title
template: index
var1: any value
var2: another value

---

<p>Any HTML here.</p>
```

Only `title` is required. After `\n---\n` you can place any HTML and then use it in your templates as `$.content`. Add `template` to specify template (or `default_template_id` will be used).

Additionally you can add any options you want. For example, `var1` will be `$.var1` in your templates.

---

## License 

(The MIT License)

Copyright © 2012 Artem Sapegin, artem@sapegin.ru, http://sapegin.me

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
