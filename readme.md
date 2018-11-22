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

## Dispatch listeners

Using `d3.dispatch`, d3-fg defines events that can be listened for and responded to in the calling application.

- `click` On clicks on the flamegraph. If the click is not on a frame, all args are passed as `null` to allow for 'deselection'-like responses:

 ```js
 flamegraph.on('click', (nodeData, rect, pointerCoords) => {
   nodeData         // Null or Object, this datum from the original data set (from node.data)
   rect,            // Null or Object, the co-ordinates of this frame's rendered rectangle
   pointerCoords    // Null or Object, the `x` and `y` co-ordinates of the click event
 }
 ```

 - `hoverin` On hovering in to a rendered frame on the flamegraph. Same args as `click`
 - `hoverout` On hovering out of a rendered frame on the flamegraph. No args passed.
 - `dblClick` On double clicking on a rendered frame on the flamegraph. Same args as `click`.
 - `contextmenu` On right clicking on a rendered frame on the flamegraph. Same args as `click`.
 - `zoom` On d3-fg executing a zoom on a frame.

 ```js
 flamegraph.on('zoom', (nodeData) => {
   nodeData         // Null or Object, this datum from the original data set (from node.data)
 }
 ```

 - `animationEnd` On d3-fg completing animations. No args.

## Options

Pass in options as an object, including optional overrides for the following built-in actions:

 - `colorHash` - Applying calculated colours using a built-in orange-to-red scale based on time spent at stack top
 - `renderTooltip` - Creating and updating a tooltip giving basic frame information
 - `renderLabel` - Writing frame information on the frames themselves in Canvas
 - `renderStackFrameBox` - Drawing the frame rectangles in Canvas, including redrawing on hover
 - `clickHandler` - Zooming in on nodes when clicked on, or zooming out when clicking outside any node
 - `isNodeExcluded` - Checking if a frame should be hidden based on its node data and the current exclusion filters

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
  exclude,    // Iterable or Array, containing type strings used to filter and hide frames
  timing,     // Boolean, if passed as true logs times to console
  categorizer: function (data, index, children) { // Function that determines the category for a given
                                                  // stack frame. e.g. "app", "core"
    return {
      type // String, indicates the category
    }
  }
  height,     // Number (pixels). If not set, is calculated based on tallest stack
  width,      // Number (pixels). If not set, is calculated based on clientWidth when called
  cellHeight, // Number (pixels). Defaults to 18 pixels. Font sizes scale along with this value.
  collapseHiddenNodeWidths, // Boolean, see below
  heatBars, // Boolean, when false (default), heat is visualized as the background colour of stack frames;
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
  },


  // Optional overridable functions. Pass a function; or null to disable. If undefined, default is used.
  colorHash: function (stackTop, options) { // Sets each frame's RGB value. Default used if unset
    const {
      d,             // Object, d3 datum: one frame, one item in the tree
      decimalAdjust, // Number, optional multiplier adjusting color intensity up or down e.g. for borders
      allSamples,    // Number, total summed time value (i.e. time represented by flamegraph width)
      tiers          // Boolean, true if base color varies by frame type e.g. app vs core
    } = options
    stackTop(d)      // Returns number representing time in this frame not in any non-hidden child frames
    return           // String, expects valid rgb, rgba or hash string
  },
  renderTooltip: function (node) { // Renders tooltips created within d3-fg
    node             // Object, a d3-fg node representing the highlighted frame
    // no return value expected
  },
  renderLabel: function (frameHeight, options) { // Writing on-frame Canvas labels
    const {
      context,       // Object, the Canvas DOM object being modified
      node,          // Object, a d3-fg node representing the frame being labelled
      x,             // Number, the x co-ordinate of the top left corner of the frame
      y,             // Number, the y co-ordinate of the top left corner of the frame
      width          // Number, the pixel width of the frame
    } = options
    frameHeight      // Number, the default pixel height for all frames in the flamegraph
  },
  renderStackFrameBox: function (globals, locals, rect) {
    const {
      STATE_HOVER,   // Number, for comparison against `state` to see if this frame is hoverred
      STATE_UNHOVER, // Number, as above but for frames that are no longer hoverred
      STATE_IDLE,    // Number, as above but for frames in normal, resting state
      frameColors,   // Object, expects color definition strings keyed `fill` and `stroke`
      colorHash      // Function, see above. Either default, override, or return frameColors.fill.
    } = globals
    const {
      context,       // Object, the Canvas DOM object being modified
      node,          // Object, a d3-fg node representing the frame being labelled
      state          // Number, see STATE_HOVER, STATE_UNHOVER and STATE_IDLE above
    } = locals
    rect             // Object, numeric { x, y, width, height } values for this frame's rectangle
  },
  clickHandler: function (target) { // Responds to clicks on the canvas, before calling dispatch
    target           // Null or Object, a d3-fg node representing the frame clicked on
    this             // The DOM object (in this case, the Canvas)
    return           // Returns target or all-stacks frame
  },
  isNodeExcluded: function (node, filterTypes) { // Used in filtering to set nodes' .hide property
    node             // Object, a d3-fg node representing the frame being filtered
    filterTypes      // Array, based on `exclude` if it is passed as an option
  }
})
```

### `collapseHiddenNodeWidths`

Boolean, affects the widths of stack frames excluded by type filters.

When true, hidden frames do not take up space, but instead all their visible children are aligned closely next to each other, to the left of their closest visible parent. In practice, this means that there are no gaps between frames. When toggling filters, frames may jump horizontally.

## Dependencies

- [hsl-to-rgb-for-reals](https://github.com/davidmarkclements/hsl_rgb_converter): simple HSL to RGB converter

## Dev Dependencies

None

## Acknowledgements

Sponsored by [nearForm](http://nearform.com).

Based on the work by [Martin Spier](<http://martinspier.io/>) at <https://www.npmjs.com/package/stackvis>.

## License

Apache 2.0
