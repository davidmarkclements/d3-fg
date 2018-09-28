var hsl = require('hsl-to-rgb-for-reals')
var rxEsc = require('escape-string-regexp')

// small pseudo d3
var d3 = Object.assign(
  {},
  require('d3-array'),
  require('d3-dispatch'),
  require('d3-ease'),
  require('d3-hierarchy'),
  require('d3-scale'),
  require('d3-selection'),
  require('d3-zoom')
)
Object.defineProperty(d3, 'event', {
  get: function () { return require('d3-selection').event }
})

var diffScale = d3.scaleLinear().range([0, 0.2])
var colors = {
  v8: {h: 67, s: 81, l: 65},
  inlinable: {h: 300, s: 100, l: 50},
  regexp: {h: 27, s: 100, l: 50},
  cpp: {h: 0, s: 50, l: 50},
  native: {h: 122, s: 50, l: 45},
  core: {h: 0, s: 0, l: 80},
  deps: {h: 244, s: 50, l: 65},
  app: {h: 200, s: 50, l: 45},
  init: {h: 21, s: 81, l: 73}
}
colors.def = {h: 10, s: 66, l: 80}
colors.js = {h: 10, s: 66, l: 80}
colors.c = {h: 10, s: 66, l: 80}

var STATE_IDLE = 0
var STATE_HOVER = 1
var STATE_UNHOVER = 2

function flameGraph (opts) {
  var tree = opts.tree
  var timing = opts.timing || false
  var element = opts.element
  var c = 18 // cell height
  var h = opts.height || (maxDepth(tree) + 2) * c // graph height
  var minHeight = opts.minHeight || 950
  h = h < minHeight ? minHeight : h
  h += opts.topOffset || 0
  var w = opts.width || document.body.clientWidth * 0.89 // graph width
  var scaleToWidth = null
  var scaleToGraph = null
  var panZoom = d3.zoom().on('zoom', function () {
    update({ animate: false })
  })
  var dispatch = d3.dispatch('zoom')
  var selection = null
  var transitionDuration = 500
  var transitionEase = d3.easeCubicInOut
  var sort = true
  var tiers = false
  var filterNeeded = true
  var filterTypes = []
  var allSamples
  var nodes = null
  var focusedFrame = null
  var hoverFrame = null
  var currentAnimation = null

  // Use custom coloring function if one has been passed in
  if (opts.colorHash) colorHash = (d, decimalAdjust, allSamples, tiers) => {
    return opts.colorHash(stackTop, { d, decimalAdjust, allSamples, tiers })
  }

  onresize()

  function onresize () {
    panZoom.translateExtent([[0, 0], [w, h]])

    scaleToWidth = d3.scaleLinear().range([0, w])
    scaleToGraph = d3.scaleLinear().domain([0, w]).range([0, 1])
  }

  function time (name, fn) {
    if (timing) {
      console.time(name)
      var result = fn()
      console.timeEnd(name)
      return result
    } else return fn()
  }

  document.addEventListener('DOMContentLoaded', () => {
    element.scrollTop = element.scrollHeight
  })

  var categorizer = opts.categorizer || categorize
  var exclude = opts.exclude || []

  function labelName (d) {
    return d.data.name
  }
  function labelStack (d) {
    if (!d.parent) return null
    var onStack = d.data.name ? Math.round(100 * (d.data.value / allSamples) * 10) / 10 + '% on stack' : ''
    var top = stackTop(d.data)
    var topOfStack = d.data.name ? (top
      ? Math.round(100 * (top / allSamples) * 100) / 100 + '% stack top'
      : '') : ''

    if (onStack && topOfStack) { onStack += ', ' }

    return onStack + topOfStack
  }

  function tooltipLabel (d) {
    if (!d.parent) return ''
    var top = stackTop(d.data)
    return d.data.name + '<br />' + (top
      ? 'Top of Stack: ' + Math.round(100 * (top / allSamples) * 10) / 10 + '% ' +
      '(' + top + ' of ' + allSamples + ' samples)<br />'
      : '') + 'On Stack: ' + Math.round(100 * (d.data.value / allSamples) * 10) / 10 + '% ' +
     '(' + d.data.value + ' of ' + allSamples + ' samples)'
  }

  function categorize (child) {
    var name = child.name

    // todo: C deps
    if (!/.js/.test(name)) {
      switch (true) {
        case /^Builtin:|^Stub:|v8::|^(.+)IC:|^.*Handler:/
          .test(name): return {type: 'v8'}
        case /^RegExp:/
          .test(name): return {type: 'regexp'}
        case /apply$|call$|Arguments$/
          .test(name): return {type: 'native'}
        case /\.$/.test(name): return {type: 'core'}
        default: return {type: 'cpp'}
      }
    }

    if (/\[INIT\]/.test(name)) return {type: 'init'}

    switch (true) {
      case / native /.test(name): return {type: 'native'}
      case (name.indexOf('/') === -1 || /internal\//.test(name) && !/ \//.test(name)): return {type: 'core'}
      case !/node_modules/.test(name): return {type: 'app'}
      default: return {type: 'deps'}
    }
  }

  function frameDepth (node) {
    var parent = node.parent
    var depth = node.depth
    if (parent && parent.data.hide) depth -= 1
    while (parent && (parent = parent.parent)) {
      if (parent.data.hide) depth -= 1
    }
    return depth
  }

  function frameWidth (d) {
    var dx = d.x1 - d.x0
    return dx * w
  }

  function filter (data) {
    if (!filterNeeded) return
    if (data.children && (data.children.length > 0)) {
      data.children.forEach(filter)
      data.children.forEach(function (child) {
        if (~filterTypes.indexOf(child.data.type)) {
          child.data.hide = true
        } else {
          child.data.hide = false
        }
      })
    }
  }

  function categorizeTree (data) {
    if (data.children && (data.children.length > 0)) {
      data.children.forEach(categorizeTree)
      data.children.forEach(function (child, ix, children) {
        var lt = categorizer(child.data, ix, children)
        child.data.type = lt.type
      })
    }
  }

  function hide (d) {
    if (!d.data.original) {
      d.data.original = d.data.value
    }
    d.data.value = 0
    if (d.children) {
      d.children.forEach(hide)
    }
  }

  function show (d) {
    d.data.fade = false
    if (d.data.original) {
      d.data.value = d.data.original
    }
    if (d.children) {
      d.children.forEach(show)
    }
  }

  function getSiblings (d) {
    var siblings = []
    if (d.parent) {
      var me = d.parent.children.indexOf(d)
      siblings = d.parent.children.slice(0)
      siblings.splice(me, 1)
    }
    return siblings
  }

  function hideSiblings (d) {
    var siblings = getSiblings(d)
    siblings.forEach(function (s) {
      hide(s)
    })
    if (d.parent) {
      hideSiblings(d.parent)
    }
  }

  function fadeAncestors (d) {
    if (d.parent) {
      d.parent.data.fade = true
      fadeAncestors(d.parent)
    }
  }

  function zoom (d) {
    if (currentAnimation) {
      currentAnimation.cancel()
      // save points before clearing the animation,
      // so that it uses the current mid-animation coords as starting points
      saveAnimationStartingPoints()
      currentAnimation = null
    }

    time('zoom', function () {
      focusedFrame = d.data
      time('hideSiblings', function () {
        hideSiblings(d)
      })
      time('show', function () {
        show(d)
      })
      time('fadeAncestors', function () {
        fadeAncestors(d)
      })
      time('update', function () {
        update({ animate: true })
      })
    })

    dispatch.call('zoom', null, d.data)
  }

  function searchTree (d, term, color) {
    var re = term instanceof RegExp ? term : new RegExp(rxEsc(term), 'i')
    var label = d.data.name

    if (d.children) {
      d.children.forEach(function (child) {
        searchTree(child, term, color)
      })
    }
    if (d.data.hide) { return }

    var searchArea
    if (d.data.type === 'cpp') { searchArea = label.split('[')[0] } else if (d.data.type === 'v8') { searchArea = label.split(' ')[0] } else if (d.data.type === 'regexp') { searchArea = label } else { searchArea = label.split(':')[0] }
    if (re.test(searchArea)) {
      d.data.highlight = color || true
    } else {
      d.data.highlight = false
    }
  }

  function clear (d, color) {
    if (!color || d.data.highlight === color) {
      d.data.highlight = false
    }
    if (d.children) {
      d.children.forEach(function (child) {
        clear(child, color)
      })
    }
  }

  function doSort (a, b) {
    if (typeof sort === 'function') {
      return sort(a, b)
    } else if (sort) {
      return d3.ascending(a.data.name, b.data.name)
    } else {
      return 0
    }
  }

  var partition = d3.partition()

  function sumChildValues (a, b) {
    // If a child is hidden or is (an ancestor of) the focusedFrame frame, don't count it
    return a + (b.fade || b === focusedFrame ? 0 : b.value)
  }

  function update (opts) {
    if (timing) console.group('update')

    var mayAnimate = opts && opts.animate

    selection.select('canvas')
      .attr('width', w)
      .attr('height', h)

    selection
      .each(function (data) {
        time('filter', function () {
          filter(data)
        })

        time('sum/sort', function () {
          data
            .sum(function (d) {
              // If this is the ancestor of a focusedFrame frame, use the same value (width) as the focusedFrame frame.
              if (d.fade) return d.children.reduce(sumChildValues, 0)

              // d3 sums value + all child values to get the value for a node,
              // we can set `value = specifiedValue - all child values` to counteract that.
              // the `.value`s in our data already include the sum of all child values.
              const childValues = d.children
                ? d.children.reduce(sumChildValues, 0)
                : 0
              return d.value - childValues
            })
            .sort(doSort)

          // Make "all stacks" as wide as every visible stack.
          data.value = data.children ? data.children.reduce(sumChildValues, 0) : 0
        })

        time('partition', function () {
          return partition(data)
        })

        nodes = data.descendants()

        var canvas = d3.select(this).select('canvas').node()

        // Animate if data was known for this set of nodes in the past.
        if (nodes[0].data.prev && mayAnimate) {
          animate()
        } else {
          time('render', function () {
            render(canvas, nodes)
            saveAnimationStartingPoints()
          })
        }

        function animate () {
          currentAnimation = createAnimation({
            duration: transitionDuration,
            ease: transitionEase
          }, (ease) => {
            render(canvas, nodes, ease)
          }, () => {
            currentAnimation = null
            saveAnimationStartingPoints()
          })
        }

        function render (canvas, nodes, ease) {
          if (ease == null) ease = 1
          var context = canvas.getContext('2d')
          context.font = '12px Verdana, sans-serif'
          context.textBaseline = 'bottom'

          context.clearRect(0, 0, canvas.width, canvas.height)

          withZoomTransform(context, function () {
            nodes.forEach(function (node) {
              renderNode(context, node, ease, STATE_IDLE)
            })
          })
        }
      })
    if (timing) console.groupEnd('update')
  }

  function withZoomTransform (context, fn) {
    var transform = d3.zoomTransform(context.canvas)
    context.save()
    context.translate(transform.x, transform.y)
    context.scale(transform.k, transform.k)
    fn()
    context.restore()
  }

  function saveAnimationStartingPoints () {
    nodes.forEach(function (node) {
      // If an animation is ongoing, use the current positions as the starting position for the new animation
      // This makes it look nice when jumping through history quickly (eg. triple click back button)
      var pts = currentAnimation
        ? currentAnimation.currentX(node)
        : node
      node.data.prev = {
        x0: pts.x0,
        x1: pts.x1,
      }
    })
  }

  function renderNode (context, node, ease, state) {
    if (node.data.hide) return

    var depth = frameDepth(node)
    var width = frameWidth(node)

    var x = scaleToWidth(node.x0)

    if (ease !== 1 && node.data.prev) {
      var prev = node.data.prev
      width = interpolate(frameWidth(prev), width, ease)
      x = interpolate(scaleToWidth(prev.x0), x, ease)
    }

    if (width < 1) return

    var strokeColor = node.parent ? colorHash(node.data, 1.1, allSamples, tiers) : 'rgba(0, 0, 0, 0.7)'
    var fillColor = node.parent
      ? (node.data.highlight
        ? (typeof node.data.highlight === 'string' ? node.data.highlight : '#e600e6')
        : colorHash(node.data, undefined, allSamples, tiers))
      : '#fff'

    if (state === STATE_HOVER || state === STATE_UNHOVER) {
      context.clearRect(x, h - (depth * c) - c, width, c)
    }

    context.fillStyle = fillColor
    context.strokeStyle = strokeColor

    context.beginPath()
    context.rect(x, h - (depth * c) - c, width, c)
    context.stroke()

    if (state === STATE_HOVER) {
      context.save()
      context.globalAlpha = 0.8
      context.fill()
      context.restore()
    } else {
      context.fill()
    }

    if (width >= 35) {
      context.save()
      context.clip()
      context.font = '12px Verdana'
      context.fillStyle = '#000'

      // Center the "all stacks" text
      if (!node.parent) {
        context.textAlign = 'center'
        x += width / 2
      } else {
        x += 4 // add padding to other nodes
      }

      var label = labelName(node)
      context.fillText(label, x, h - (depth * c) - 1)

      var stack = labelStack(node)
      if (stack) {
        var offs = context.measureText(label + ' ').width
        context.font = '10px Verdana'
        context.fillText(stack, x + offs, h - (depth * c) - 2)
      }

      context.restore()
    }
  }

  function renderTooltip (node) {
    var wrapper = d3.select(element)
    var canvas = wrapper.select('canvas').node()
    var transform = d3.zoomTransform(canvas)
    var x = transform.applyX(scaleToWidth(node.x0)) + canvas.getBoundingClientRect().left
    // y = the bottom of the node - the scroll from the top
    // (because the tooltip uses absolute positioning)
    var y = transform.applyY(h - frameDepth(node) * c) - wrapper.node().scrollTop
    var label = tooltipLabel(node)

    var tooltip = d3.select(element).select('.d3-flame-graph-tooltip')
      .style('top', y + 'px')
      .style('display', 'block')
      // scale up the font size with the graph zoom level,
      // but don't scale it down below 10pt because it'd be unreadable,
      // and don't go above 25pt which should be huge enough for even the
      // largest screens
      .style('font-size', Math.max(10, Math.min(25, transform.k * 10)) + 'pt')
      .html(label)

    // 300px is an arbitrary cut off point. if it's "too near"
    // to the right edge, instead align with the rightmost end of
    // the node
    // The 300px is scaled along with the rest of the graph to make sure that
    // tooltips don't get super squished at higher zoom levels
    if (x + (transform.k * 300) > window.innerWidth) {
      var right = canvas.getBoundingClientRect().left + w
      x = window.innerWidth - right + scaleToWidth(1 - node.x1)
      tooltip.style('left', 'auto').style('right', x + 'px')
    } else {
      tooltip.style('right', 'auto').style('left', x + 'px')
    }
  }

  // Wait for 500 ms before showing the tooltip.
  var tooltipFocusNode = null
  var tooltipFocusTimeout = null
  function showTooltip (node) {
    if (tooltipFocusNode === node) {
      return renderTooltip(node)
    }
    clearTimeout(tooltipFocusTimeout)
    tooltipFocusTimeout = setTimeout(function () {
      tooltipFocusNode = node
      renderTooltip(node)
    }, 500)
  }

  function hideTooltip () {
    clearTimeout(tooltipFocusTimeout)
    tooltipFocusNode = null
    tooltipFocusTimeout = setTimeout(function () {
      d3.select(element).select('.d3-flame-graph-tooltip')
        .style('display', 'none')
        .empty()
    }, 250)
  }

  // cancel hiding the tooltip, used when the cursor moves
  // from the hovered node to the tooltip or vice versa to
  // cancel the mouseout event from the previously focused one.
  function preventHideTooltip () {
    clearTimeout(tooltipFocusTimeout)
  }

  function getNodeAt (canvas, offsetX, offsetY) {
    var transform = d3.zoomTransform(canvas)
    var x = scaleToGraph(transform.invertX(offsetX))
    var y = h - transform.invertY(offsetY)
    return nodes.find(function (node) {
      if (node.data.hide) return false
      if (node.x0 <= x && x <= node.x1) {
        var nodeY = frameDepth(node) * c
        return nodeY <= y && y <= nodeY + c
      }
      return false
    })
  }

  function chart (firstRender) {
    selection = d3.select(element)

    selection.each(function (data) {
      allSamples = data.data.value

      if (!firstRender) {
        node = d3.select(this).append('div')
          .style('position', 'relative')
        node.append('canvas')
          .attr('width', w)
          .attr('height', h)
          .attr('class', 'partition d3-flame-graph')
          .attr('transition', 'transform 200ms ease-in-out')
          .call(panZoom)
          .on('wheel.zoom', null)
          .on('dblclick.zoom', null)
          .on('click', function () {
            var target = getNodeAt(this, d3.event.offsetX, d3.event.offsetY)
            return zoom(target || nodes[0])
          })
          .on('mousemove', function () {
            var target = getNodeAt(this, d3.event.offsetX, d3.event.offsetY)
            var context = this.getContext('2d')

            if (target === hoverFrame) return

            if (hoverFrame) {
              withZoomTransform(context, function () {
                renderNode(context, hoverFrame, 1, STATE_UNHOVER)
              })
            }
            hoverFrame = target

            if (target) {
              this.style.cursor = 'pointer'
              withZoomTransform(context, function () {
                renderNode(context, target, 1, STATE_HOVER)
              })
              if (target.parent) showTooltip(target)
              else hideTooltip()
            } else {
              this.style.cursor = 'default'
              hideTooltip()
            }
          })
          .on('mouseout', function () {
            this.style.cursor = 'default'
            hideTooltip()
          })
        node.append('div')
          .style('background', '#222')
          .style('color', '#fff')
          .style('border-radius', '3px')
          .style('padding', '3px')
          .style('font-size', '10pt')
          .style('position', 'fixed')
          .style('display', 'none')
          .style('z-index', 1000)
          .classed('d3-flame-graph-tooltip', true)
          .on('mouseover', preventHideTooltip)
          .on('mouseout', hideTooltip)

        // Adjust canvas for high DPI screens
        // - Size the image up N× using attributes
        // - Squash it down N× using CSS
        // - Scale the context so 1px in all subsequent draw operations means Npx
        if (window.devicePixelRatio && window.devicePixelRatio !== 1) {
          node.select('canvas')
            .style('width', w)
            .style('height', h)
            .attr('width', w * window.devicePixelRatio)
            .attr('height', h * window.devicePixelRatio)

          var context = node.select('canvas').node().getContext('2d')
          context.scale(window.devicePixelRatio, window.devicePixelRatio)
        }
      }

      categorizeTree(data)
      filter(data)

      // first draw
      update()
    })
  }

  chart.height = function (_) {
    if (!arguments.length) { return h }
    h = _
    onresize()
    update()
    return chart
  }

  chart.width = function (_) {
    if (!arguments.length) { return w }
    w = _
    onresize()
    update()
    return chart
  }

  chart.cellHeight = function (_) {
    if (!arguments.length) { return c }
    c = _
    return chart
  }

  chart.transitionDuration = function (_) {
    if (!arguments.length) { return transitionDuration }
    transitionDuration = _
    return chart
  }

  chart.transitionEase = function (_) {
    if (!arguments.length) { return transitionEase }
    transitionEase = _
    return chart
  }

  chart.sort = function (_) {
    if (!arguments.length) { return sort }
    sort = _
    return chart
  }

  chart.tiers = function (_) {
    tiers = _
    if (selection) update()
    return chart
  }

  chart.search = function (term, color) {
    selection.each(function (data) {
      searchTree(data, term, color)
      update()
    })
  }

  chart.clear = function (color) {
    selection.each(function (data) {
      clear(data, color)
      update()
    })
  }

  chart.typeHide = function (type) {
    if (!~filterTypes.indexOf(type)) {
      filterTypes.push(type)
      filterNeeded = true
      if (selection) update()
    }
  }

  chart.typeShow = function (type) {
    var ix = filterTypes.indexOf(type)
    if (!~ix) return
    filterTypes.splice(ix, 1)
    filterNeeded = true
    if (selection) update()
  }

  chart.setGraphZoom = function (n) {
    panZoom.scaleTo(d3.select(element).select('canvas'), n)
  }

  chart.renderTree = function (data) {
    d3.select(element).datum(d3.hierarchy(data, function (d) { return d.c || d.children }))
    chart(true)
  }

  chart.colors = colors

  chart.update = (hard) => {
    if (hard) {
      selection.each(function (data) {
        allSamples = data.value

        categorizeTree(data)
        filter(data)

        // first draw
        update()
      })
    } else update()
  }

  chart.zoom = (data = nodes[0].data) => {
    // nodes[0] = root node
    // users of this method can zoom in on a data point
    // instead of a node.
    const node = nodes.find(n => n.data === data)
    zoom(node || nodes[0])
  }

  chart.on = dispatch.on.bind(dispatch)

  exclude.forEach(chart.typeHide)
  d3.select(element).datum(d3.hierarchy(tree, function (d) { return d.c || d.children }))
  chart()

  return chart
}

// This function can be overridden by passing a function to opts.colorHash
function colorHash (d, perc, allSamples, tiers) {
  if (!d.name) {
    return perc ? 'rgb(127, 127, 127)' : 'rgba(0, 0, 0, 0)'
  }

  perc = perc || 1
  var type = d.type || 'def'

  var key

  if (!tiers) key = colors.def

  if (tiers) key = colors[type]

  var h = key.h
  var s = key.s
  var l = key.l
  var top = stackTop(d)
  var vector = ((top / allSamples) * 100) + 1

  s *= vector
  l += (vector * 2)

  s /= 100
  l /= 100

  s *= perc
  l *= perc

  var a = 0.8
  if (l > 0.8) {
    a += diffScale(l - 0.8)
    l = 0.8
  }

  var rgb = hsl(h, s, l)
  var res = 'rgba(' + rgb + ', ' + a + ')'

  return res
}

function stackTop (d) {
  if (!d.children) return d.top
  var top = d.top

  d.children
    .forEach(function (child) {
      if (
        !child.children ||
          child.children.filter(function (c) { return c.hide }).length
      ) {
        if (child.hide) {
          top += stackTop(child)
        }
      }
    })

  return top
}

function maxDepth (tree) {
  if (!tree.children) {
    return 1
  }
  return tree.children.map(maxDepth).reduce((prev, next) => Math.max(prev, next), 0) + 1
}

function createAnimation (opts, render, done) {
  var start = Date.now()
  var animationFrame = null
  var dt = 0
  var ease = 0

  function nextFrame () {
    dt = (Date.now() - start) / opts.duration
    ease = opts.ease(dt > 1 ? 1 : dt)
    render(ease)

    if (ease === 1) {
      animationFrame = null
      done()
    } else {
      animationFrame = requestAnimationFrame(nextFrame)
    }
  }
  animationFrame = requestAnimationFrame(nextFrame)

  return {
    cancel () {
      cancelAnimationFrame(animationFrame)
    },
    currentX (node) {
      var prev = node.data.prev
      return {
        x0: interpolate(prev.x0, node.x0, ease),
        x1: interpolate(prev.x1, node.x1, ease)
      }
    }
  }
}

function interpolate (start, end, ease) {
  return start + ease * (end - start)
}

module.exports = flameGraph
module.exports.colors = colors
module.exports.colorHash = colorHash
