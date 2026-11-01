import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { View } from 'react-native';
import Svg from 'react-native-svg';
import { gestureEvent, getTouch } from './gestures';
import { rectCenter } from './utils';

export const ShapeSelectionContext = React.createContext(null);
export const CallbacksContext = React.createContext({});
export const VectorHeightContext = React.createContext(0);
export const VectorWidthContext = React.createContext(0);
export const ScaleContext = React.createContext(1);

class ShapeEditor extends Component {
  constructor(props) {
    super(props);
    this.wrappedShapes = [];
    this.justAddedShapes = [];
    this.origin = { x: 0, y: 0 };
    this.callbacks = {
      getPlaneCoordinatesFromEvent: this.getPlaneCoordinatesFromEvent.bind(this),
      onShapeMountedOrUnmounted: this.onShapeMountedOrUnmounted.bind(this),
      setMouseHandler: this.setMouseHandler.bind(this),
      startGesture: this.startGesture.bind(this),
      onGestureEvent: this.onGestureEvent.bind(this),
      focusShape: this.focusShape.bind(this),
      blurShape: this.blurShape.bind(this),
      clearFocus: this.clearFocus.bind(this),
      onGestureEnd: this.onGestureEnd.bind(this),
    };
  }

  componentDidUpdate() {
    if (this.justAddedShapes.length && this.props.focusOnAdd) {
      this.justAddedShapes[this.justAddedShapes.length - 1].forceFocus();
    } else if (this.lastDeletedRect && this.props.focusOnDelete) {
      const center = rectCenter(this.lastDeletedRect);
      let distance = Infinity;
      let closest;
      this.wrappedShapes.forEach(shape => {
        if (shape.props.disabled) return;
        const next = rectCenter(shape.props);
        const d = (center.x - next.x) ** 2 + (center.y - next.y) ** 2;
        if (d < distance) { distance = d; closest = shape; }
      });
      if (closest) closest.forceFocus();
    }
    this.justAddedShapes = [];
    this.lastDeletedRect = null;
  }

  componentDidMount() {
    this.unmounted = false;
    // Initial shapes keep their original unfocused state.
    this.justAddedShapes = [];
  }

  componentWillUnmount() {
    this.unmounted = true;
    this.cancelGesture();
    this.wrappedShapes = [];
    this.justAddedShapes = [];
    this.focusedShape = null;
  }

  onShapeMountedOrUnmounted(instance, didMount) {
    if (didMount) {
      this.wrappedShapes.push(instance);
      if (!instance.props.disabled) this.justAddedShapes.push(instance);
    } else {
      this.lastDeletedRect = instance.props;
      this.wrappedShapes = this.wrappedShapes.filter(shape => shape !== instance);
      this.justAddedShapes = this.justAddedShapes.filter(shape => shape !== instance);
      if (this.focusedShape === instance) this.focusedShape = null;
    }
  }

  focusShape(shape, event) {
    if (this.focusedShape === shape || shape.props.disabled) return;
    if (this.focusedShape) this.focusedShape.setFocused(false, event);
    this.focusedShape = shape;
    shape.setFocused(true, event);
  }

  clearFocus(event = {}) {
    if (this.focusedShape) this.blurShape(this.focusedShape, event);
  }

  blurShape(shape, event) {
    if (this.focusedShape === shape) this.focusedShape = null;
    shape.setFocused(false, event);
  }

  // Public commands let native toolbars and external keyboard adapters use the
  // same constraints, callbacks and selection behavior as direct manipulation.
  focusShapeById(shapeId) {
    const shape = this.wrappedShapes.find(item => item.props.shapeId === shapeId);
    if (shape) shape.forceFocus();
  }

  handleKeyDown(event) {
    if (this.focusedShape) this.focusedShape.handleKeyDown(gestureEvent(event, 'keydown'));
  }

  moveActiveShape(dx, dy) {
    if (this.focusedShape) this.focusedShape.keyboardMove(dx, dy);
  }

  resizeActiveShape(dw, dh) {
    if (this.focusedShape) this.focusedShape.keyboardResize(dw, dh);
  }

  deleteActiveShape(event = {}) {
    if (this.focusedShape) this.focusedShape.deleteShape(event);
  }

  cancelGesture() {
    const handler = this.mouseHandler;
    this.mouseHandler = null;
    this.pendingGesture = null;
    this.gestureVersion = (this.gestureVersion || 0) + 1;
    if (handler) handler({ type: 'cancel' });
  }

  setMouseHandler(handler, previousHandler) {
    if (previousHandler && this.mouseHandler !== previousHandler) return;
    if (handler && this.mouseHandler && this.mouseHandler !== handler) this.cancelGesture();
    this.mouseHandler = handler;
    if (!handler) {
      this.pendingGesture = null;
      this.gestureVersion = (this.gestureVersion || 0) + 1;
    }
  }

  startGesture(onStart, event, handler) {
    this.cancelGesture();
    this.mouseHandler = handler;
    this.touchIdentifier = getTouch(event).identifier;
    const version = this.gestureVersion;
    const pending = { events: [] };
    this.pendingGesture = pending;
    const begin = (x = 0, y = 0) => {
      if (this.unmounted || this.gestureVersion !== version) return;
      this.origin = { x, y };
      this.pendingGesture = null;
      onStart(event);
      pending.events.forEach(next => this.onGestureEvent(next));
    };
    // Measure at every grant so scrolling, safe areas and moved editor views
    // cannot leave stale screen offsets. Snapshot events while this is pending.
    if (this.container && this.container.measure) {
      this.container.measure((x, y, width, height, pageX, pageY) => begin(pageX, pageY));
    } else {
      begin(this.origin.x, this.origin.y);
    }
  }

  onGestureEnd(event) {
    const changed = event.nativeEvent.changedTouches || [];
    if (changed.some(touch => touch.identifier === this.touchIdentifier)) {
      this.onGestureEvent({ ...event, type: 'mouseup' });
    }
  }

  onGestureEvent(event) {
    if (this.pendingGesture) {
      this.pendingGesture.events.push(event);
      return;
    }
    const touches = event.nativeEvent && event.nativeEvent.touches;
    if (event.type === 'mousemove' && touches && !touches.some(touch => touch.identifier === this.touchIdentifier)) return;
    const handler = this.mouseHandler;
    if (handler) handler(event);
    if ((event.type === 'mouseup' || event.type === 'cancel') && this.mouseHandler === handler) {
      this.mouseHandler = null;
    }
  }

  getPlaneCoordinatesFromEvent(event, { x: offsetX = 0, y: offsetY = 0 } = {}) {
    const touch = getTouch(event, this.touchIdentifier);
    return {
      x: (touch.pageX - this.origin.x) / this.props.scale - offsetX,
      y: (touch.pageY - this.origin.y) / this.props.scale - offsetY,
    };
  }

  render() {
    const { children, focusOnAdd, focusOnDelete, scale, vectorHeight, vectorWidth,
      style, svgProps, onLayout, ...otherProps } = this.props;
    if (!Number.isFinite(scale) || scale <= 0) throw new Error('ShapeEditor scale must be a finite positive number');
    return (
      <View
        {...otherProps}
        ref={ref => { this.container = ref; }}
        collapsable={false}
        style={[{ width: vectorWidth * scale, height: vectorHeight * scale }, style]}
        onLayout={onLayout}
      >
        <Svg
          {...svgProps}
          width={vectorWidth * scale}
          height={vectorHeight * scale}
          viewBox={`0 0 ${vectorWidth} ${vectorHeight}`}
        >
          <CallbacksContext.Provider value={this.callbacks}>
            <VectorHeightContext.Provider value={vectorHeight}>
              <VectorWidthContext.Provider value={vectorWidth}>
                <ScaleContext.Provider value={scale}>{children}</ScaleContext.Provider>
              </VectorWidthContext.Provider>
            </VectorHeightContext.Provider>
          </CallbacksContext.Provider>
        </Svg>
      </View>
    );
  }
}

ShapeEditor.propTypes = {
  children: PropTypes.node,
  focusOnAdd: PropTypes.bool,
  focusOnDelete: PropTypes.bool,
  scale: (props, name) => (props[name] > 0 && Number.isFinite(props[name]) ? null : new Error('scale must be a finite positive number')),
  style: PropTypes.any,
  svgProps: PropTypes.object,
  onLayout: PropTypes.func,
  vectorHeight: PropTypes.number,
  vectorWidth: PropTypes.number,
};
ShapeEditor.defaultProps = {
  children: null, focusOnAdd: true, focusOnDelete: true,
  scale: 1, style: undefined, svgProps: {}, vectorHeight: 0, vectorWidth: 0,
};

export default ShapeEditor;
