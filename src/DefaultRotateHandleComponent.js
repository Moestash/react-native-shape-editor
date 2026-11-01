import React from 'react';
import { Circle } from 'react-native-svg';

export default function DefaultRotateHandleComponent({
  active, isInSelectionGroup, gestureHandlers, radius, scale, x, y,
}) {
  if (isInSelectionGroup) return null;
  return (
    <Circle
      testID="rotate-handle"
      {...gestureHandlers}
      fill={active ? 'rgba(229,240,244,1)' : 'rgba(229,240,244,0.3)'}
      stroke={active ? 'rgba(53,33,140,1)' : 'rgba(53,33,140,0.3)'}
      strokeWidth={1 / scale} r={radius} cx={x} cy={y}
    />
  );
}
