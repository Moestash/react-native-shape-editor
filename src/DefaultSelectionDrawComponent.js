import React from 'react';
import { Rect } from 'react-native-svg';
import wrapShape from './wrapShape';

const DefaultSelectionDrawComponent = wrapShape(({ height, width }) => (
  <Rect fill="rgba(140,179,255,0.3)" height={height} width={width} />
));

export default DefaultSelectionDrawComponent;
