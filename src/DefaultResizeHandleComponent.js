import React from 'react';
import { Rect } from 'react-native-svg';

export default function DefaultResizeHandleComponent({
  active, isInSelectionGroup, gestureHandlers, recommendedSize, scale, x, y, name,
}) {
  if (isInSelectionGroup) return null;
  return (
    <Rect
      testID={`resize-${name}`}
      {...gestureHandlers}
      fill={active ? 'rgba(229,240,244,1)' : 'rgba(229,240,244,0.3)'}
      stroke={active ? 'rgba(53,33,140,1)' : 'rgba(53,33,140,0.3)'}
      strokeWidth={1 / scale}
      width={recommendedSize} height={recommendedSize}
      x={x - recommendedSize / 2} y={y - recommendedSize / 2}
    />
  );
}
