import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Rect } from 'react-native-svg';
import { getRectFromCornerCoordinates, getBounds, containsPoint, rotatePoint, rectCenter } from './utils';
import { getGestureHandlers, getTouch } from './gestures';
import { CallbacksContext, ShapeSelectionContext } from './ShapeEditor';
import withContext from './withContext';
import DefaultSelectionDrawComponent from './DefaultSelectionDrawComponent';
import DefaultSelectionComponent from './DefaultSelectionComponent';

export const SelectionContext = ShapeSelectionContext;
const SELECTION_ID = 'rse-internal-selection-component';

function getSelectionRect(shapes) {
  const bounds = shapes.map(shape => getBounds(shape.props));
  const x = Math.min(...bounds.map(rect => rect.x));
  const y = Math.min(...bounds.map(rect => rect.y));
  return {
    x, y, width: Math.max(...bounds.map(rect => rect.x + rect.width)) - x,
    height: Math.max(...bounds.map(rect => rect.y + rect.height)) - y, rotation: 0,
  };
}

function transformChild(start, end, props) {
  const scaleX = start.width ? end.width / start.width : 1;
  const scaleY = start.height ? end.height / start.height : 1;
  const width = props.width * scaleX;
  const height = props.height * scaleY;
  const center = rotatePoint({
    x: end.x + (props.x - start.x) * scaleX + width / 2,
    y: end.y + (props.y - start.y) * scaleY + height / 2,
  }, rectCenter(end), end.rotation || 0);
  const position = props.constrainMove({
    originalX: props.x, originalY: props.y,
    x: center.x - width / 2, y: center.y - height / 2, width, height,
  });
  const corner = props.constrainResize({
    originalMovingCorner: { x: position.x + props.width, y: position.y + props.height },
    startCorner: position, movingCorner: { x: position.x + width, y: position.y + height }, lockedDimension: null,
  });
  return getRectFromCornerCoordinates(position, corner, (props.rotation || 0) + (end.rotation || 0));
}

class SelectionLayer extends Component {
  constructor(props) {
    super(props);
    this.state = { rect: null };
    this.wrappedShapes = {};
    this.mouseHandler = this.mouseHandler.bind(this);
    this.callbacks = {
      ...props.callbacks,
      onChildRectChanged: this.onChildRectChanged.bind(this),
      onChildFocus: this.onChildFocus.bind(this),
      onChildToggleSelection: this.onChildToggleSelection.bind(this),
      onShapeMountedOrUnmounted: this.onSelectionShapeMountedOrUnmounted.bind(this),
    };
  }

  componentDidMount() {
    this.unmounted = false;
    if (this.selectedShapes.length >= 2) this.forceUpdate();
  }

  componentDidUpdate(prevProps) {
    if (this.selectedChildrenDidChange) {
      this.selectedChildrenDidChange = false;
      if (this.selectedShapes.length >= 2) this.forceUpdate();
    }
    if (this.props.selectedShapeIds !== prevProps.selectedShapeIds) {
      if (this.selectedShapes.length >= 2 && this.selectionEl) this.selectionEl.forceFocus();
      else if (this.selectedShapes.length === 1) this.selectedShapes[0].forceFocus();
      else if (prevProps.selectedShapeIds.length) this.props.clearFocus();
    }
  }

  componentWillUnmount() {
    this.unmounted = true;
    this.props.setMouseHandler(null, this.mouseHandler);
  }

  get selectedShapes() {
    return this.props.selectedShapeIds.map(id => this.wrappedShapes[id]).filter(shape => shape && !shape.props.disabled);
  }

  onSelectionShapeMountedOrUnmounted(instance, didMount) {
    this.props.onShapeMountedOrUnmounted(instance, didMount);
    if (didMount) this.wrappedShapes[instance.props.shapeId] = instance;
    else delete this.wrappedShapes[instance.props.shapeId];
    this.onChildRectChanged(instance.props.shapeId);
  }

  onChildRectChanged(id, internal) {
    if (!internal && this.props.selectedShapeIds.includes(id)) this.selectedChildrenDidChange = true;
  }

  onChildFocus(id, internal) {
    if (internal) return;
    if (this.props.selectedShapeIds.length !== 1 || this.props.selectedShapeIds[0] !== id) {
      this.props.onSelectionChange([id]);
    }
  }

  onChildToggleSelection(clickedId, internal, event) {
    if (internal && clickedId !== SELECTION_ID) return;
    let targetId = clickedId;
    if (clickedId === SELECTION_ID) {
      const point = this.props.getPlaneCoordinatesFromEvent(event);
      // SVG native nodes have no DOM elementsFromPoint. Use inverse-rotated
      // geometry and paint order to find the shape behind the selection overlay.
      const shape = Object.values(this.wrappedShapes).reverse().find(item => !item.props.disabled && containsPoint(item.props, point));
      if (!shape) return;
      targetId = shape.props.shapeId;
    }
    const ids = this.props.selectedShapeIds;
    this.props.onSelectionChange(ids.includes(targetId) ? ids.filter(id => id !== targetId) : [...ids, targetId]);
  }

  deleteSelection(event = {}) {
    this.props.onDelete(event, this.selectedShapes.map(shape => shape.props));
  }

  moveSelection(dx, dy) {
    const shapes = this.selectedShapes;
    if (!shapes.length) return;
    const rect = getSelectionRect(shapes);
    this.commitTransform(rect, {
      ...rect, x: rect.x + dx * this.props.keyboardTransformMultiplier,
      y: rect.y + dy * this.props.keyboardTransformMultiplier,
    }, shapes);
  }

  resizeSelection(dw, dh) {
    const shapes = this.selectedShapes;
    if (!shapes.length) return;
    const rect = getSelectionRect(shapes);
    this.commitTransform(rect, {
      ...rect, width: Math.max(0, rect.width + dw * this.props.keyboardTransformMultiplier),
      height: Math.max(0, rect.height + dh * this.props.keyboardTransformMultiplier),
    }, shapes);
  }

  commitTransform(start, end, shapes) {
    shapes.forEach(shape => shape.simulateTransform(null));
    this.props.onChange(shapes.map(shape => transformChild(start, end, shape.props)), shapes.map(shape => shape.props));
  }

  start(event) {
    const start = this.props.getPlaneCoordinatesFromEvent(event);
    this.drag = { start, current: start, previousIds: this.props.selectedShapeIds };
    this.setState({ rect: getRectFromCornerCoordinates(start, start) });
    if (this.props.selectionMode !== 'multiple') {
      this.props.clearFocus(event);
      this.props.onSelectionChange([]);
    }
  }

  selectionIsLargeEnough(rect) {
    return Math.max(rect.width, rect.height) >= this.props.minimumDistanceForSelection;
  }

  mouseHandler(event) {
    if (!this.drag) return;
    if (event.type === 'cancel') {
      const { previousIds } = this.drag;
      this.drag = null;
      this.setState({ rect: null });
      this.props.onSelectionChange(previousIds);
      return;
    }
    if (event.type === 'mousemove' || (event.type === 'mouseup' && Number.isFinite(getTouch(event).pageX))) {
      this.drag.current = this.props.getPlaneCoordinatesFromEvent(event);
      this.setState({ rect: getRectFromCornerCoordinates(this.drag.start, this.drag.current) });
    }
    if (event.type === 'mouseup') {
      const rect = getRectFromCornerCoordinates(this.drag.start, this.drag.current);
      const previousIds = this.drag.previousIds;
      this.drag = null;
      this.setState({ rect: null });
      if (!this.selectionIsLargeEnough(rect)) return;
      const ids = Object.keys(this.wrappedShapes).filter(id => {
        const shape = this.wrappedShapes[id];
        const bounds = getBounds(shape.props);
        return !shape.props.disabled && bounds.x + bounds.width > rect.x && bounds.x < rect.x + rect.width &&
          bounds.y + bounds.height > rect.y && bounds.y < rect.y + rect.height;
      });
      const next = this.props.selectionMode === 'multiple' ? [...new Set([...previousIds, ...ids])] : ids;
      this.props.onSelectionChange(next);
      if (next.length === 1 && this.wrappedShapes[next[0]]) this.wrappedShapes[next[0]].forceFocus();
    }
  }

  render() {
    const { children, vectorHeight, vectorWidth, SelectionComponent, SelectionDrawComponent,
      selectionComponentProps, keyboardTransformMultiplier, selectedShapeIds, selectionMode } = this.props;
    if (!this.selectionContext || this.selectionContext.selectedShapeIds !== selectedShapeIds || this.selectionContext.selectionMode !== selectionMode) {
      this.selectionContext = { selectedShapeIds, selectionMode };
    }
    const shapes = this.selectedShapes;
    const rect = this.state.rect;
    let extra = null;
    if (rect && this.selectionIsLargeEnough(rect)) {
      extra = <SelectionDrawComponent {...rect} disabled isInternalComponent shapeId="rse-internal-selection-draw-component" />;
    } else if (!rect && shapes.length >= 2) {
      const selectionRect = getSelectionRect(shapes);
      extra = (
        <SelectionComponent
          {...selectionComponentProps} {...selectionRect}
          keyboardTransformMultiplier={keyboardTransformMultiplier}
          shapeId={SELECTION_ID} isInternalComponent
          ref={ref => { this.selectionEl = ref; }}
          onIntermediateChange={next => shapes.forEach(shape => shape.simulateTransform(transformChild(selectionRect, next, shape.props)))}
          onTransformCancel={() => shapes.forEach(shape => shape.simulateTransform(null))}
          onDelete={event => this.deleteSelection(event)}
          onChange={next => this.commitTransform(selectionRect, next, shapes)}
        />
      );
    }
    return (
      <>
        <Rect
          testID="selection-layer" width={vectorWidth} height={vectorHeight} fill="transparent"
          {...getGestureHandlers(event => this.start(event), { ...this.props.callbacks, handler: this.mouseHandler })}
        />
        <CallbacksContext.Provider value={this.callbacks}>
          <ShapeSelectionContext.Provider value={this.selectionContext}>
            {children}
            {extra}
          </ShapeSelectionContext.Provider>
        </CallbacksContext.Provider>
      </>
    );
  }
}

SelectionLayer.propTypes = {
  selectedShapeIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  onSelectionChange: PropTypes.func.isRequired,
  selectionMode: PropTypes.oneOf(['single', 'multiple']),
};
SelectionLayer.defaultProps = {
  keyboardTransformMultiplier: 1, minimumDistanceForSelection: 15, selectionMode: 'single',
  onChange: () => {}, onDelete: () => {}, SelectionComponent: DefaultSelectionComponent,
  selectionComponentProps: {}, SelectionDrawComponent: DefaultSelectionDrawComponent,
};
export default withContext(SelectionLayer);
