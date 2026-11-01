import React from 'react';
import { Rect } from 'react-native-svg';
import wrapShape from './wrapShape';

const DefaultSelectionComponent = wrapShape(({ height, scale, width }) => (
  <Rect
    fill="transparent"
    stroke="rgba(140,179,255,1)"
    strokeWidth={2 / scale}
    height={height}
    width={width}
  />
));

export default DefaultSelectionComponent;
