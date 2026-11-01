const React = require('react');
const measure = jest.fn(callback => callback(0, 0, 600, 800, 90, 120));
const View = React.forwardRef((props, ref) => {
  React.useImperativeHandle(ref, () => ({ measure }));
  return React.createElement('NativeView', props, props.children);
});
module.exports = {
  View, Text: 'NativeText', Pressable: 'NativePressable', TextInput: 'NativeTextInput',
  Modal: 'NativeModal', ScrollView: 'NativeScrollView',
  Image: {
    resolveAssetSource: jest.fn(source => typeof source === 'number' ? { uri: 'asset.png', width: 80, height: 60 } : source),
    getSize: jest.fn(), getSizeWithHeaders: jest.fn(),
  },
  __measure: measure,
};
