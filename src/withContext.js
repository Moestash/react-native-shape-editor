import React, { useContext } from 'react';
import {
  CallbacksContext,
  ShapeSelectionContext,
  VectorHeightContext,
  VectorWidthContext,
  ScaleContext,
} from './ShapeEditor';

function withContext(Component) {
  function ComponentWithRseContext(props, ref) {
    const selection = useContext(ShapeSelectionContext);
    const selected = !!selection && selection.selectedShapeIds.includes(props.shapeId);
    const callbacks = useContext(CallbacksContext);
    const vectorHeight = useContext(VectorHeightContext);
    const vectorWidth = useContext(VectorWidthContext);
    const scale = useContext(ScaleContext);
    return (
      <Component
        {...props}
        {...callbacks}
        callbacks={callbacks}
        active={props.active === undefined && selection && !props.isInternalComponent ? selected : props.active}
        isInSelectionGroup={props.isInSelectionGroup === undefined ? selected && selection.selectedShapeIds.length >= 2 : props.isInSelectionGroup}
        selectionMode={props.selectionMode || (selection ? selection.selectionMode : undefined)}
        vectorHeight={vectorHeight}
        vectorWidth={vectorWidth}
        ref={ref}
        scale={scale}
      />
    );
  }

  ComponentWithRseContext.displayName =
    Component.displayName || Component.name || 'Component';

  return React.forwardRef(ComponentWithRseContext);
}

export default withContext;
