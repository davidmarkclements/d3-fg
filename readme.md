# d3-fg

Flamegraph visualization for d3 v5.x

## Installation

```sh
npm install d3-fg --save
```

## Usage

d3-fg is currently built against [d3](http://npm.im/d3) v5.x.

```js
var tree = require('./data.json') // d3 json tree
var element = document.querySelector('chart') // <chart> element which should be in html body
require('d3-flamegraph')({tree, element})
```

## Dependencies

- [hsl-to-rgb-for-reals](https://github.com/davidmarkclements/hsl_rgb_converter): simple HSL to RGB converter

## Dev Dependencies

None

## Acknowledgements

Sponsored by [nearForm](http://nearform.com).

Based on the work by [Martin Spier](<http://martinspier.io/>) at <https://www.npmjs.com/package/stackvis>.

## License

Apache 2.0
