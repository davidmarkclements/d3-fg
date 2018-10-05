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
  categorizer: function (data, index, children) { // Function that determines the category for a given
                                                  // stack frame. e.g. "app", "core"
    return // String, indicates the category
  }
  height,     // Number (pixels). If not set, is calculated based on tallest stack
  width,      // Number (pixels). If not set, is calculated based on clientWidth when called
  cellHeight, // Number (pixels). Defaults to 18 pixels. Font sizes scale along with this value.
  colorHash: function (stackTop, options) { // Function sets each frame's RGB value. Default used if unset
    const {
      d,             // Object, d3 datum: one frame, one item in the tree
      decimalAdjust, // Number, optional multiplier adjusting color intensity up or down e.g. for borders
      allSamples,    // Number, total summed time value (i.e. time represented by flamegraph width)
      tiers          // Boolean, true if base color varies by frame type e.g. app vs core
    } = options
    stackTop(d)      // Returns number representing time in this frame not in any non-hidden child frames
    return           // String, expects valid rgb, rgba or hash string
  },
  heatBars, // Boolean, when false (the default), heat is visualized as the background colour of stack frames;
            // when true, heat is visualized by a bar drawn on _top_ of stack frames
  frameColors: { // Object, colors for the stack frame boxes.
                 // Used when `heatBars: true`, and for the "all stacks" row when `heatBars: false`
    fill,   // String, background color.
    stroke, // String, border color.
  },
  labelColors: { // Object, colors for the text labels on stack frames
    default,        // String, the default color (required).
    [categoryName], // Optionally, colors for different categories such as "app", "cpp".
                    // If one of these is not set for a category, labelColors.default is used
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
