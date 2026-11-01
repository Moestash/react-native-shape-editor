const React = require('react');
const components = {};
['Svg', 'G', 'Rect', 'Circle', 'Image', 'Text', 'TSpan', 'Path', 'Ellipse', 'Polygon'].forEach(name => {
  components[name] = name;
});
module.exports = { __esModule: true, default: 'Svg', ...components };
