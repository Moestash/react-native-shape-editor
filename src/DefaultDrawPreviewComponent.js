import React from 'react';
import { Rect } from 'react-native-svg';
import wrapShape from './wrapShape';

const DefaultDrawPreviewComponent = wrapShape(({ height, width }) => (
  <Rect fill="rgba(0,0,255,0.5)" height={height} width={width} />
));

export default DefaultDrawPreviewComponent;
