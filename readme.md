# d3-flamegraph 

Flamegraph visualization for d3 v3.5.x

## Installation

```sh
npm install d3-flamegraph --save
```

## Usage

d3-flamegraph is currently built against [d3](http://npm.im/d3) v3.5.x, which means
`d3` has to be in the global namespace.

```js
global.d3 = require('d3')
var width = document.body.innerWidth * 0.85
var height = width
var langsMode = false // color code Cpp vs JS
var tiersMode = false // color code various code categories
require('d3-flamegraph')
  .width(width)
  .height(height)
  .langs(langsMode)
  .tiers(tiersMode)
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
