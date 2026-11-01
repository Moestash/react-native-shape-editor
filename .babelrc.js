module.exports = api => {
  const native = api.caller(caller => !!caller && caller.name === 'metro');
  const test = api.env('test');
  return {
    presets: native
      ? ['module:@react-native/babel-preset']
      : [
        ['@babel/preset-env', test ? { targets: { node: 'current' } } : { modules: false }],
        ['@babel/preset-react', { runtime: 'automatic' }],
      ],
  };
};
