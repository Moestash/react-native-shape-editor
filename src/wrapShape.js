import React from 'react';
import PropTypes from 'prop-types';
import { G } from 'react-native-svg';
import DefaultResizeHandleComponent from './DefaultResizeHandleComponent';
import DefaultRotateHandleComponent from './DefaultRotateHandleComponent';
import withContext from './withContext';
import { getGestureHandlers, getTouch } from './gestures';
import {
  getRectFromCornerCoordinates, defaultConstrainMove, defaultConstrainResize,
  rotatePoint, rectCenter, getRotatedResizeRect,
} from './utils';

const noop = () => {};

function wrapShape(WrappedComponent) {
  class WrappedShape extends React.PureComponent {
    constructor(props) {
      super(props);
      this.state = { nativeActive: false, preview: null };
      this.mouseHandler = this.mouseHandler.bind(this);
    }

    componentDidMount() {
      this.unmounted = false;
      if (!this.props.isInternalComponent) this.props.onShapeMountedOrUnmounted(this, true);
    }

    componentDidUpdate(prevProps) {
      if (['x', 'y', 'width', 'height', 'rotation', 'disabled'].some(key => this.props[key] !== prevProps[key])) {
        this.props.onChildRectChanged(this.props.shapeId, this.props.isInternalComponent);
      }
      if (this.props.disabled && !prevProps.disabled) {
        this.cancelTransform();
        this.props.blurShape(this);
      }
    }

    componentWillUnmount() {
      this.unmounted = true;
      this.props.setMouseHandler(null, this.mouseHandler);
      if (!this.props.isInternalComponent) this.props.onShapeMountedOrUnmounted(this, false);
      else if (this.state.nativeActive) this.props.blurShape(this);
    }

    get rect() {
      const { x, y, width, height, rotation } = this.props;
      return { x, y, width, height, rotation };
    }

    get handlers() {
      return { ...this.props.callbacks, handler: this.mouseHandler };
    }

    setFocused(focused, event = {}) {
      if (this.unmounted) return;
      this.setState({ nativeActive: focused });
      if (focused) {
        this.props.onChildFocus(this.props.shapeId, this.props.isInternalComponent);
        this.props.onFocus(event, this.props);
      } else {
        this.props.onBlur(event, this.props);
      }
    }

    forceFocus(event) {
      if (!this.props.disabled) this.props.focusShape(this, event);
    }

    deleteShape(event = {}) {
      if (!this.props.disabled) this.props.onDelete(event, this.props);
    }

    startMove(event) {
      if (this.props.disabled) return;
      event.stopPropagation();
      // Toggle before focusing, since focusing normally replaces the selection.
      if (event.shiftKey || this.props.selectionMode === 'multiple') {
        this.props.onChildToggleSelection(this.props.shapeId, this.props.isInternalComponent, event);
        return;
      }
      this.forceFocus(event);
      const point = this.props.getPlaneCoordinatesFromEvent(event);
      this.drag = {
        mode: 'move', original: this.rect,
        offset: { x: point.x - this.props.x, y: point.y - this.props.y },
        next: this.rect,
      };
      this.setState({ preview: this.rect });
    }

    startResize(event, corner, lock) {
      if (this.props.disabled) return;
      event.stopPropagation();
      this.forceFocus(event);
      const original = this.rect;
      const { x, y, width, height } = original;
      const points = {
        nw: { x, y }, ne: { x: x + width, y },
        sw: { x, y: y + height }, se: { x: x + width, y: y + height },
      };
      const anchors = { nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' };
      const moving = points[corner];
      const point = rotatePoint(this.props.getPlaneCoordinatesFromEvent(event), rectCenter(original), -original.rotation);
      this.drag = {
        mode: 'resize', original, anchor: points[anchors[corner]], moving,
        offset: { x: point.x - moving.x, y: point.y - moving.y }, lock, next: original,
      };
      this.setState({ preview: original });
    }

    calculateAngle(event, rect = this.rect) {
      const point = this.props.getPlaneCoordinatesFromEvent(event);
      const center = rectCenter(rect);
      return Math.atan2(point.y - center.y, point.x - center.x);
    }

    startRotation(event) {
      if (this.props.disabled) return;
      event.stopPropagation();
      this.forceFocus(event);
      const point = this.props.getPlaneCoordinatesFromEvent(event);
      const now = getTouch(event).timestamp || Date.now();
      if (this.lastRotationTap && now - this.lastRotationTap.time < 300 &&
          Math.hypot(point.x - this.lastRotationTap.point.x, point.y - this.lastRotationTap.point.y) * this.props.scale < 20) {
        this.lastRotationTap = null;
        this.resetRotation();
        return;
      }
      this.lastRotationTap = { time: now, point };
      this.drag = { mode: 'rotate', original: this.rect, angle: this.calculateAngle(event), next: this.rect };
      this.setState({ preview: this.rect });
    }

    resetRotation() {
      if (!this.props.disabled) this.props.onChange({ ...this.rect, rotation: 0 }, this.props);
    }

    updateTransform(event) {
      const drag = this.drag;
      if (!drag || this.unmounted || this.props.disabled) return;
      const point = this.props.getPlaneCoordinatesFromEvent(event);
      let next;
      if (drag.mode === 'move') {
        const { x, y } = this.props.constrainMove({
          originalX: drag.next.x, originalY: drag.next.y,
          x: point.x - drag.offset.x, y: point.y - drag.offset.y,
          width: drag.original.width, height: drag.original.height,
        });
        next = { ...drag.original, x, y };
      } else if (drag.mode === 'resize') {
        const local = rotatePoint(point, rectCenter(drag.original), -drag.original.rotation);
        const constrained = this.props.constrainResize({
          originalMovingCorner: drag.moving, startCorner: drag.anchor,
          movingCorner: { x: local.x - drag.offset.x, y: local.y - drag.offset.y },
          lockedDimension: drag.lock,
        });
        drag.moving = {
          x: drag.lock === 'x' ? drag.moving.x : constrained.x,
          y: drag.lock === 'y' ? drag.moving.y : constrained.y,
        };
        next = getRotatedResizeRect(drag.anchor, drag.moving, drag.original);
      } else {
        const angle = this.calculateAngle(event, drag.original);
        // Unwrap across -PI/PI so rotationSpeed does not cause a full-circle jump.
        const delta = Math.atan2(Math.sin(angle - drag.angle), Math.cos(angle - drag.angle));
        next = { ...drag.original, rotation: drag.next.rotation + delta * 180 / Math.PI * this.props.rotationSpeed };
        drag.angle = angle;
        if (Math.abs(next.rotation - drag.original.rotation) > 2) this.lastRotationTap = null;
      }
      drag.next = next;
      this.setState({ preview: next });
      this.props.onIntermediateChange(next);
    }

    mouseHandler(event) {
      if (event.type === 'cancel') { this.cancelTransform(); return; }
      if (!this.drag) return;
      if (event.type === 'mousemove') this.updateTransform(event);
      if (event.type === 'mouseup') {
        // Native release may contain a final position that had no move event.
        if (Number.isFinite(getTouch(event).pageX)) this.updateTransform(event);
        const { next, original } = this.drag;
        this.drag = null;
        if (this.unmounted) return;
        this.setState({ preview: null });
        if (Object.keys(next).some(key => next[key] !== original[key])) this.props.onChange(next, this.props);
      }
    }

    cancelTransform() {
      this.props.setMouseHandler(null, this.mouseHandler);
      this.drag = null;
      if (!this.unmounted) this.setState({ preview: null });
      this.props.onTransformCancel();
    }

    simulateTransform(nextRect) {
      if (!this.unmounted) this.setState({ preview: nextRect ? { ...this.rect, ...nextRect } : null });
    }

    keyboardMove(dx, dy) {
      if (this.props.disabled) return;
      const { x, y, width, height } = this.props;
      const position = this.props.constrainMove({
        originalX: x, originalY: y,
        x: x + dx * this.props.keyboardTransformMultiplier,
        y: y + dy * this.props.keyboardTransformMultiplier, width, height,
      });
      this.props.onChange({ ...this.rect, ...position }, this.props);
    }

    keyboardResize(dx, dy) {
      if (this.props.disabled) return;
      const { x, y, width, height } = this.props;
      const corner = this.props.constrainResize({
        originalMovingCorner: { x: x + width, y: y + height }, startCorner: { x, y },
        movingCorner: {
          x: x + width + dx * this.props.keyboardTransformMultiplier,
          y: y + height + dy * this.props.keyboardTransformMultiplier,
        }, lockedDimension: null,
      });
      const next = getRotatedResizeRect({ x, y }, corner, this.rect);
      this.props.onChange(next, this.props);
    }

    handleKeyDown(event) {
      if (this.props.disabled) return;
      this.props.onKeyDown(event, this.props);
      if (event.defaultPrevented) return;
      const directions = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      if (directions[event.key]) {
        if (event.shiftKey) this.keyboardResize(...directions[event.key]);
        else this.keyboardMove(...directions[event.key]);
      } else if (event.key === 'Backspace' || event.key === 'Delete') this.deleteShape(event);
      else return;
      if (event.preventDefault) event.preventDefault();
    }

    render() {
      const {
        active: artificialActive, disabled, isInSelectionGroup, scale, shapeId,
        ResizeHandleComponent, RotateHandleComponent, wrapperProps,
        callbacks, constrainMove, constrainResize, getPlaneCoordinatesFromEvent,
        isInternalComponent, keyboardTransformMultiplier, onBlur, onChange,
        onChildFocus, onChildRectChanged, onChildToggleSelection, onDelete, onFocus,
        onIntermediateChange, onKeyDown, onShapeMountedOrUnmounted, onTransformCancel,
        setMouseHandler, startGesture, onGestureEvent, onGestureEnd, focusShape, blurShape, clearFocus,
        vectorHeight, vectorWidth, selectionMode, rotationSpeed, ...otherProps
      } = this.props;
      const { nativeActive, preview } = this.state;
      const active = artificialActive === null ? nativeActive : artificialActive;
      const rect = preview || this.rect;
      const { x, y, width, height, rotation } = rect;
      const cornerSize = this.props.handleSize / scale;
      const handleSpecs = [
        height * scale > this.props.handleSize * 2 && ['w', 'nw', 0, height / 2, 'y'],
        width * scale > this.props.handleSize * 2 && ['n', 'ne', width / 2, 0, 'x'],
        width * scale > this.props.handleSize * 2 && ['s', 'sw', width / 2, height, 'x'],
        height * scale > this.props.handleSize * 2 && ['e', 'se', width, height / 2, 'y'],
        ['nw', 'nw', 0, 0, null], ['ne', 'ne', width, 0, null],
        ['sw', 'sw', 0, height, null], ['se', 'se', width, height, null],
      ].filter(Boolean);
      const rotationGestureHandlers = getGestureHandlers(event => this.startRotation(event), this.handlers);
      return (
        <G
          {...wrapperProps}
          testID={wrapperProps.testID || `shape-${shapeId}`}
          transform={`translate(${x},${y}) rotate(${rotation},${width / 2},${height / 2})`}
          pointerEvents={disabled ? 'none' : wrapperProps.pointerEvents}
          {...getGestureHandlers(event => this.startMove(event), this.handlers, !disabled)}
        >
          <WrappedComponent
            {...otherProps}
            shapeId={shapeId} scale={scale} disabled={disabled}
            isInSelectionGroup={isInSelectionGroup} active={active} nativeActive={nativeActive}
            isBeingChanged={!!preview} width={width} height={height} rotation={rotation}
          />
          {!disabled && handleSpecs.map(([name, corner, hx, hy, lock]) => {
            const start = event => this.startResize(event, corner, lock);
            const gestureHandlers = getGestureHandlers(start, this.handlers);
            return (
              <ResizeHandleComponent
                key={name} name={name} active={active} nativeActive={nativeActive}
                isInSelectionGroup={isInSelectionGroup} recommendedSize={cornerSize}
                cursor={lock === 'x' ? 'ns-resize' : 'ew-resize'}
                x={hx} y={hy} scale={scale} gestureHandlers={gestureHandlers}
                onMouseDown={event => gestureHandlers.onResponderGrant(event)}
              />
            );
          })}
          {!disabled && (
            <RotateHandleComponent
              name="rotate-handle" active={active} nativeActive={nativeActive}
              isInSelectionGroup={isInSelectionGroup} cursor="grab"
              recommendedSize={cornerSize} radius={cornerSize / 2} scale={scale}
              x={width / 2} y={-cornerSize * 2.5}
              gestureHandlers={rotationGestureHandlers}
              onMouseDown={rotationGestureHandlers.onResponderGrant}
              onDoubleClick={() => this.resetRotation()}
            />
          )}
        </G>
      );
    }
  }

  WrappedShape.propTypes = {
    shapeId: PropTypes.string.isRequired,
    x: PropTypes.number.isRequired, y: PropTypes.number.isRequired,
    width: PropTypes.number.isRequired, height: PropTypes.number.isRequired,
  };
  WrappedShape.defaultProps = {
    active: null, disabled: false, isInSelectionGroup: false, isInternalComponent: false,
    constrainMove: defaultConstrainMove, constrainResize: defaultConstrainResize,
    keyboardTransformMultiplier: 1, handleSize: 20, rotation: 0, rotationSpeed: 1,
    onBlur: noop, onChange: noop, onChildFocus: noop, onChildRectChanged: noop,
    onChildToggleSelection: noop, onDelete: noop, onFocus: noop,
    onIntermediateChange: noop, onKeyDown: noop, onTransformCancel: noop,
    ResizeHandleComponent: DefaultResizeHandleComponent,
    RotateHandleComponent: DefaultRotateHandleComponent, wrapperProps: {},
  };
  WrappedShape.displayName = `wrapShape(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
  return withContext(WrappedShape);
}

export default wrapShape;
