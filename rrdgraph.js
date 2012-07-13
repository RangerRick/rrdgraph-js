/*******************************************************************************
 * This file is part of OpenNMS(R).
 *
 * Copyright (C) 2007-2011 The OpenNMS Group, Inc.
 * OpenNMS(R) is Copyright (C) 1999-2011 The OpenNMS Group, Inc.
 *
 * OpenNMS(R) is a registered trademark of The OpenNMS Group, Inc.
 *
 * OpenNMS(R) is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * OpenNMS(R) is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with OpenNMS(R).  If not, see:
 *      http://www.gnu.org/licenses/
 *
 * For more information contact:
 *     OpenNMS(R) Licensing <license@opennms.org>
 *     http://www.opennms.org/
 *     http://www.opennms.com/
 ******************************************************************************/

RRDGraph = {};

/*******************************************************************************
 * Data/config grabber
 ******************************************************************************/
(function () {
  var get = RRDGraph.get = {};

  get.config = function (src) { // {resourceId, report}
    // TODO: decide how to get this from the server
    return '';
  };

  get.data = function () { // {resourceId, report, start, end}
    // TODO: decide how to get this from the server
    return {};
  };
})();

/*******************************************************************************
 * The config
 ******************************************************************************/

(function () {
  var tokenize = function (str) {
    var delined = str.replace(/\\\n/g, ' ');

    var regex = /[^\s"]*["]+?[^"]+?["]+?[^\s"']*|[^\s"]+/g;
    var tokens = [];
    var match;
    while (match = regex.exec(delined)) {
      tokens.push(match[0].replace(/"/g, ''));
    }

    return tokens;
  };

  var regex = {
    def: /^[CV]?DEF:/,
    graph: /^PRINT|^GPRINT|^COMMENT|^VRULE|^HRULE|^LINE|^AREA|^TICK|^SHIFT|^TEXTALIGN/,
    print: /^[G]?PRINT/,
    line: /^LINE/,
    split: /\\%%SPLIT%%/g,
    colon: /:/g
  };

  var short_tags = {
    's': 'start', 'e': 'end', 'S': 'step', 't': 'title', 'v': 'vertical-label',
    'w': 'width', 'h': 'height', 'j': 'only-graph', 'D': 'full-size-mode',
    'u': 'upper-limit', 'l': 'lower-limit', 'r': 'rigid', 'A': 'alt-autoscale',
    'J': 'alt-autoscale-min', 'M': 'alt-autoscale-max', 'N': 'no-gridfit',
    'x': 'x-grid', 'y': 'y-grid', 'Y': 'alt-y-grid', 'o': 'logarithmic',
    'X': 'units-exponent', 'L': 'units-length', 'g': 'no-legend',
    'F': 'force-rules-legend', 'c': 'color', 'm': 'zoom', 'n': 'font',
    'P': 'pango-markup', 'G': 'graph-render-mode', 'E': 'slope-mode',
    'T': 'tabwidth', 'b': 'base', 'W': 'watermark'
  };

  var cast_options = function (options, cast, option_names) {
    for (var o in option_names) {
      var option = option_names[o];
      options[option] = cast(options[option]);
    }
  };

  var parse = function (config_string) {
    var result = {
      options: {
        'start'             : '-86400', // 1 day before
        'end'               : 0,
        'step'              : 1,
        'title'             : '',
        'vertical-label'    : '',
        'width'             : 400,
        'height'            : 100,
        'full-size-mode'    : false,
        'only-graph'        : false,
        'upper-limit'       : null,
        'lower-limit'       : null,
        'rigid'             : false,
        'alt-autoscale'     : false,
        'alt-autoscale-min' : false,
        'alt-autoscale-max' : false,
        'no-gridfit'        : true,
        'x-grid'            : '', // TODO: reasonable default
        'y-grid'            : '', // TODO: reasonable default
        'alt-y-grid'        : false,
        'logarithmic'       : false,
        'units-exponent'    : 0, // TODO: reasonable default
        'units-length'      : 0,
        'units'             : 'si',
        'right-axis'        : '1:1', // scale:shift
        'right-axis-label'  : '',
        'right-axis-format' : '',
        'no-legend'         : false,
        'force-rules-legend': false,
        'legend-position'   : 'south',
        'legend-direction'  : 'topdown',
        'color'             : '', // TODO: reasonable default
        'grid-dash'         : '1:1',
        'border'            : 2,
        'dynamic-labels'    : false,
        'zoom'              : 1,
        'font'              : {
          'title' : {
            'family': 'monospace',
            'size': 13
          },
          'axis' : {
            'family': 'monospace',
            'size': 10
          },
          'unit' : {
            'family': 'monospace',
            'size': 10
          },
          'legend' : {
            'family': 'monospace',
            'size': 10
          },
          'watermark' : {
            'family': 'monospace',
            'size': 8
          },
        },
        'pango-markup'      : false,
        'graph-render-mode' : 'normal',
        'slope-mode'        : false,
        'tabwidth'          : 40,
        'base'              : 1000,
        'watermark'         : ''
      },
      defs: {
        data: {},
        value: {},
        calc: {}
      },
      graphs: {
        textalign: 'justified',
        elements: []
      }
    };

    var tokens = tokenize(config_string);

    for (var t = 0, l = tokens.length; t < l; ++t) {
      var token = tokens[t];

      if (regex.def.test(token)) {
        var subtokens = token.split(':');
        
        var name;
        var value;
        var type;

        if (token.charAt(0) === 'D') { // DEF
          type = 'data';
          value = {};

          var name_rrd = subtokens[1].split('=');
          name = name_rrd[0];
          value.rrd = name_rrd[1];
          value.ds_name = subtokens[2];
          value.cf = subtokens[3];

          for (var st = 4, sl = subtokens.length; st < sl; ++st) {
            var st_kv = subtokens[st].split('=');
            value[st_kv[0]] = st_kv[1];
          }
        } else {
          type = (token.charAt(0) === 'C') ? 'calc' : 'value';

          var split_at = token.indexOf('=');
          name = token.slice(5, split_at);
          value = token.slice(split_at + 1);
        }

        result.defs[type][name] = value;
      } else if (token.charAt(0) === '-' && token.length > 1) {
        var n_dashes = (token.charAt(1) === '-') ? 2 : 1;
        var option = token.slice(n_dashes);
        
        var value = true;
        var key_value = option.split('=');

        if (key_value.length > 1) {
          option = key_value[0];
          value = key_value[1];
        } else if (tokens[t + 1].charAt(0) !== '-' && !regex.def.test(tokens[t + 1])) {
          value = tokens[++t];
        }

        if (option in short_tags) option = short_tags[option];

        if (option === 'font') {
          var font = value.split(':');

          var size = parseInt(font[1]);
          if (size) {
            result.options[option][font[0].toLowerCase()].size = size;
          }
          
          if (font[2]) {
            result.options[option][font[0].toLowerCase()].family = font[2];
          }
        } else {
          result.options[option] = value;
        }
      } else if (regex.graph.test(token)) {
        token = token.replace(regex.colon, '%%SPLIT%%');
        token = token.replace(regex.split, ':');

        var subtokens = token.split('%%SPLIT%%');
        var element = {
          type: null
        };

        if (regex.print.test(subtokens[0])) {
          element.type = subtokens[0].toLowerCase();

          element.vname = subtokens[1];
          if (subtokens.length === 3) { // newer
            element.format = subtokens[2];
          } else { // deprecated type
            element.format = subtokens[3];
            element.cf = subtokens[2];
          }
        } else if (subtokens[0] === 'COMMENT') {
          element.type = 'comment';

          element.text = subtokens[1];
        } else if (subtokens[0] === 'SHIFT') {
          element.type = 'shift';

          element.vname = subtokens[1];
          element.offset = subtokens[2];
        } else if (subtokens[0] === 'TEXTALIGN') {
          result.graphs.textalign = subtokens[1];
        } else if (subtokens[0] === 'TICK') {
          element.type = 'tick';

          var vname_color = subtokens[1].split('#');
          element.vname = vname_color[0];
          element.color = vname_color[1];
          
          if (subtokens.length > 3) {
            element.legend = subtokens[3];
          }

          element.fraction = 0.1;

          if (subtokens.length >= 3) {
            element.fraction = subtokens[2];
          }
        } else { // vrule, hrule, line or area

          if (regex.line.test(subtokens[0])) {
            element.type = 'line';

            if (subtokens[0].length > 4) {
              element.width = parseFloat(subtokens[0].slice(4));
            } else {
              element.width = 1;
            }
          } else {
            element.type = subtokens[0].toLowerCase();
          }

          var key_color = subtokens[1].split('#');
          if (element.type === 'vrule') {
            element.time = key_color[0];
          } else { // hrule, line, area
            element.value = key_color[0];
          }

          if (key_color.length === 2) {
            element.color = key_color[1];
          } else {
            element.color = '000000';
          }

          if (subtokens.length >= 3) { // legend
            element.legend = subtokens[2];

            for (var st = 3, sl = subtokens.length; st < sl; ++st) {
              if (subtokens[st] === 'STACK') {
                element.stack = true;
              } else { // dashes or dash-offset
                var key_value = subtokens[st].split('=');
                if (key_value[0] === 'dashes') {
                  if (key_value.length === 2) {
                    element.dashes = key_value[1];
                  } else {
                    element.dashes = '5,5';
                  }
                } else { // dash-offset
                  element.dash_offset = subtokens[st].split('=')[1];
                }
              }
            }
          }
        }

        if ('color' in element) { // extract opacity
          if (element.color.length === 6) { // just color, default opacity
            element.color = '#' + element.color;
            element.opacity = 1.0;
          } else {
            var opacity_hex = parseInt(element.color.slice(6), 16);
            element.color = '#' + element.color.slice(0, 6);
            element.opacity = opacity_hex / 255.0;
          }
        }

        if (element.type !== null) {
          result.graphs.elements.push(element);
        }
      }
    }

    cast_options(result.options, parseInt, [
      'step', 'width', 'height', 'units-exponent', 'units-length', 'border',
      'tabwidth', 'base', 
    ]);

    cast_options(result.options, parseFloat, ['upper-limit', 'lower-limit', 'zoom']);

    return result;
  };

  RRDGraph.Config = function (src, config_string) {
    if (src) {
      config_string = RRDGraph.get.config(src);
    }
    var config = parse(config_string);

    this.options = config.options;
    this.defs = config.defs;
    this.graphs = config.graphs;
  };
})();

/*******************************************************************************
 * The data class
 ******************************************************************************/
(function () {
  var Data = RRDGraph.Data = function (src, config) {
    this.src = src;
    this.config = config;

    this.listeners = [];

    this.setup();
    this.push(RRDGraph.get.data(src));
  };

  Data.prototype.setup = function () {
    this.data = {
      arrays: {}, // DEFS and CDEFS
      values: {} // VDEFS
    };

    this.extremes = {
      x: {min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY},
      y: {min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY}
    };

    for (var def in this.config.defs.data) {
      this.data.arrays[def] = [];
    }
    for (var cdef in this.config.defs.calc) {
      this.data.arrays[cdef] = [];
    }
    for (var vdef in this.config.defs.value) {
      this.data.values[vdef] = {t: NaN, v: NaN};
    }

  };

  Data.prototype.addListener = function (graph) {
    this.listeners.push(graph);
  };

  Data.prototype.notifyUpdate = function () {
    for (var l = 0, len = this.listeners.length; l < len; ++l) {
      this.listeners[l].update();
    }
  };

  Data.prototype.push = function (points) {
    this.extremes.x.min = Number.POSITIVE_INFINITY;
    this.extremes.x.max = Number.NEGATIVE_INFINITY;
    this.extremes.y.min = Number.POSITIVE_INFINITY;
    this.extremes.y.max = Number.NEGATIVE_INFINITY;

    for (var name in points) {
      var defs = [];
      for (var d in this.config.defs.data) {
        var def = this.config.defs.data[d];
        if (def.rrd === name) {
          defs.push(d);
        }
      }

      for (var d = 0; d < defs.length; ++d) {
        for (var p = 0, len = points[name].length; p < len; ++p) {
          this.data.arrays[defs[d]].push(points[name][p]);
        }
      }
    }

    // TODO: update cdefs, vdefs

    var domain_length = this.src.end - this.src.start;
    for (var d in this.data.arrays) {
      var def = this.data.arrays[d];

      if (def.length > 1) {
        // Remove all but one element outside the graph (one is left for interpolation)
        while (def[1].t <= def[def.length - 1].t - domain_length) {
         def.shift();
        }
      }

      // Value extremes, remove NaNs
      for (var p = 0, len = def.length; p < len; ++p) {
        if (def[p].v > this.extremes.y.max) this.extremes.y.max = def[p].v;
        if (def[p].v < this.extremes.y.min) this.extremes.y.min = def[p].v;
      }

      // Time extremes
      if (def.length > 0) {
        if (def[def.length - 1].t > this.extremes.x.max) this.extremes.x.max = def[def.length - 1].t;
        if (def[0].t < this.extremes.x.min) this.extremes.x.min = def[0].t;
      }
    }

    this.notifyUpdate();
  };
})();


/*******************************************************************************
 * The graph class
 ******************************************************************************/

(function () {
  var Graph = RRDGraph.Graph = function (element, config) {
    this.element = d3.select(element);
    this.config = config;

    this.svg = {};

    this.createStatics();
    this.adjustDimensionsAndPositions();
    this.defineDynamics();
  };

  Graph.prototype.createStatics = function () {
    var container = this.svg.container = this.element.append('svg:svg').
      attr('shape-rendering', 'crispEdges').
      style('background-color', '#f3f3f3').
      style('border-right', this.config.options.border + 'px solid #999').
      style('border-bottom', this.config.options.border + 'px solid #999').
      style('border-top', this.config.options.border + 'px solid #ccc').
      style('border-left', this.config.options.border + 'px solid #ccc');

    this.canvas_padding = {
      x: this.config.options.font.unit.size + 50,
      y: this.config.options.font.title.size + 20
    };

    var canvas = this.svg.canvas = container.append('svg:g').
      attr('transform', 
           'translate(' + this.canvas_padding.x + ',' + this.canvas_padding.y + ')');

    this.svg.canvas_bg = canvas.append('svg:rect').
      attr('fill', '#fff');

    this.svg.title = container.append('svg:text').
      attr('text-anchor', 'middle').
      text(this.config.options.title).
      style('font-size', this.config.options.font.title.size + 'px').
      style('font-family', this.config.options.font.title.family);

    this.svg.v_label = container.append('svg:text').
      style('font-size', this.config.options.font.unit.size + 'px').
      style('font-family', this.config.options.font.unit.family).
      attr('transform', 'rotate(270)').
      text(this.config.options['vertical-label']);

    this.svg.logo = container.append('svg:text').
      attr('fill', '#aaa').
      style('font', '9px monospace').
      attr('transform', 'rotate(90)').
      text('RRDGRAPH-JS / D3.JS');

    if (this.config.options.watermark !== '') {
      this.svg.watermark = container.append('svg:text').
        attr('fill', '#aaa').
        attr('text-anchor', 'middle').
        text(this.config.options.watermark).
        style('font-size', this.config.options.font.watermark.size + 'px').
        style('font-family', this.config.options.font.watermark.family);
    }
  };

  Graph.prototype.defineDynamics = function () {
    var scales = this.scales = {
      y: d3.scale.linear().range([this.config.options.height, 0]),
      x: d3.time.scale().range([0, this.config.options.width])
    };

    this.graph_elements = [];

    for (var g = 0, len = this.config.graphs.elements.length; g < len; ++g) {
      var e = this.config.graphs.elements[g];
      if (e.type === 'line') {
        var line = this.graph_elements[g] = d3.svg.line().
          x(function (d) { return scales.x(new Date(d.t)) }).
          y(function (d) { return scales.y(d.v) }).
          defined(function (d) { return d.v !== null; }).
          interpolate('linear');
        this.svg.canvas.selectAll('path.line-' + g).
          data([[]]).enter().append('svg:path').
          attr('d', line([])).
          attr('class', 'line line-' + g).
          attr("fill", "none").
          attr("stroke", e.color).
          attr('stroke-width', e.width).
          attr('shape-rendering', 'auto');
      }
      // TODO: areas
    }

    // TODO: axes, grid
  };

  Graph.prototype.createLegend = function () { // TODO
    var y = this.canvas_padding.y + this.config.options.height + 
      this.config.options.font.axis.size + 10;

    var legend = this.svg.legend = this.svg.container.append('svg:rect').
      attr('width', this.svg.container.attr('width') - 20).
      attr('height', 30).
      attr('x', 10).
      attr('y', y).
      attr('fill', '#fff').
      append('svg:text');

    this.svg.container.append('svg:text').
      attr('fill', '#000').
      attr('x', 15).
      attr('y', y + 20).
      text('Legend will be here');

    return {y: y, height: 30};
  };

  Graph.prototype.adjustDimensionsAndPositions = function () {
    /* TODO: full-size-mode and only-graph are not supported (yet) */

    var dims = {
      width: this.config.options.width,
      height: this.config.options.height
    };

    this.svg.canvas_bg.
      attr('width', dims.width).
      attr('height', dims.height);

    this.svg.container.
      attr('width', dims.width + this.canvas_padding.x + 30); // TODO: right-axis padding

    this.svg.title.
      attr('x', this.svg.container.attr('width') / 2).
      attr('y', this.config.options.font.title.size + 5);

    this.svg.v_label.
      attr('x', -dims.height / 2 - this.canvas_padding.y).
      attr('y', this.config.options.font.unit.size + 2);

    this.svg.logo.
      attr('x', 2).
      attr('y', 9 - this.svg.container.attr('width'));

    var legend;
    if (!this.config.options['no-legend']) {
      /* The legend is created here because it needs to know the dimensions
       * of the container and the canvas */
      var legend = this.createLegend();
    } else {
      legend = {
        y: this.canvas_padding.y + this.config.options.height + 
          this.config.options.font.axis.size + 10,
        h: 0
      };
    }

    var container_height = legend.y + legend.height + 8;

    if (this.svg.watermark !== undefined) {
      var watermark_y = legend.y + legend.height + 
        this.config.options.font.watermark.size + 5;
      this.svg.watermark.
        attr('x', this.svg.container.attr('width') / 2).
        attr('y', watermark_y);
      container_height += this.config.options.font.watermark.size + 5;
    }

    this.svg.container.
      attr('height', container_height);
  };

  Graph.prototype.bind = function (data) {
    this.data = data;
    data.addListener(this);
    this.update();
  };

  Graph.prototype.update = function () {
    this.scales.y.
      domain([Math.floor(this.data.extremes.y.min), Math.ceil(this.data.extremes.y.max)]);
    this.scales.x.
        domain([this.data.extremes.x.min, this.data.extremes.x.max]);

    // TODO: Lines only ATM
    for (var g = 0, len = this.config.graphs.elements.length; g < len; ++g) {
      var e = this.config.graphs.elements[g];
      if (e.type === 'line') {
        var line = this.graph_elements[g];
        this.svg.canvas.selectAll('path.line-' + g).
          data([this.data.data.arrays[e.value]]).
          attr('d', line);
      }
    }

  };


})();

/*******************************************************************************
 * Main functions
 ******************************************************************************/

(function () {
  var parseSrc = function (src) {
    var parts = src.split('&');
    var kv = {};
    for (var p in parts) {
      var key_value = parts[p].split('=');
      kv[key_value[0]] = key_value[1];
    }
    return kv;
  };

  RRDGraph.init = function (selector) {
    var result = [];
    d3.selectAll(selector).each(function () {
      var src = parseSrc(this.dataset.src);
      var element = this;

      var config = new RRDGraph.Config(src);
      var graph = new RRDGraph.Graph(element, config);
      var data = new RRDGraph.Data(src, config);

      graph.bind(data);

      result.push({
        config: config,
        graph: graph,
        data: data
      });
    });

    return result;
  };

})();