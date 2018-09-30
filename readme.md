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
var flamegraph = require('d3-flamegraph')({tree, element})
```

## Options

Pass in options as an object:

```js
require('d3-flamegraph')({
  // Required:
  tree: {     // tree object like d3.hierarchy() https://github.com/d3/d3-hierarchy/#hierarchy - expects:
    parent,   // Object reference with same schema, falsy for root node (options.tree itself)
    children, // Array of objects with same schema, falsy for leaf nodes (nodes without children)
    depth     // Number of ancestors in tree (position in stack from bottom), zero for root node
  },
  element,    // Existing DOM reference. Do not pass a d3 selection, use d3.select(...).node()

  // Optional:
  timing,     // Boolean, if passed as true logs times to console
  height,     // Number (pixels). If not set, is calculated based on tallest stack
  width,      // Number (pixels). If not set, is calculated based on clientWidth when called
  colorHash: function (stackTop, options) { // Function sets each frame's RGB value. Default used if unset
    const {
      d,             // Object, d3 datum: one frame, one item in the tree
      decimalAdjust, // Number, optional multiplier adjusting colour intensity up or down e.g. for borders
      allSamples,    // Number, total summed time value (i.e. time represented by flamegraph width)
      tiers          // Boolean, true if base color varies by frame type e.g. app vs core
    } = options
    stackTop(d)      // Returns number representing time in this frame not in any non-hidden child frames
    return           // String, expects valid rgb, rgba or hash string
  }
})
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
