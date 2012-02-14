# Sweet: Simplest Web Engine Ever, The

Sweet is a very simple static websites generator powered by Node.js. Contains template engine, JavaScript concatenator/minificator and Stylus support. (You can use only those parts you need.)


### Features

  - Content in JSON or HTML
  - [Fest templates](https://github.com/mailru/fest)
  - JavaScript concatenator/minificator (uses [UglifyJS](https://github.com/mishoo/UglifyJS))
  - [Stylus](https://github.com/LearnBoost/stylus) support (plain CSS not supported yet)
  - Embedded web server
  - Multi-language
  - Watch for changes in content, templates and styles


## Installation

```bash
$ npm install swe -g
```


### Example

See `example` folder.


### Command line switches

`swe`

Build website.

`swe -d`

Debug mode. You can test for `$.debug` in your templates.

`swe -w`

Watch mode. Will rebuild website on any change in content, templates or styles.

`swe -s`

Build and serve your website to localhost.

`swe -p`

Serve & watch & debug. The most convenient mode for development.


### Configuration

Place `sweet.json` to your project’s root directory.

...Coming soon...


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
