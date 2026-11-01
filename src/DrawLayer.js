import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Rect } from 'react-native-svg';
import { getRectFromCornerCoordinates, defaultConstrainMove, defaultConstrainResize } from './utils';
import { getGestureHandlers, getTouch } from './gestures';
import withContext from './withContext';
import DefaultDrawPreviewComponent from './DefaultDrawPreviewComponent';

class DrawLayer extends Component {
  constructor(props) {
    super(props);
    this.state = { rect: null };
    this.mouseHandler = this.mouseHandler.bind(this);
  }

  componentWillUnmount() {
    this.props.setMouseHandler(null, this.mouseHandler);
  }

  start(event) {
    this.props.clearFocus(event);
    const { x, y } = this.props.getPlaneCoordinatesFromEvent(event);
    const { vectorWidth, vectorHeight } = this.props;
    const start = this.props.constrainMove({
      originalX: x, originalY: y, x, y, width: 0, height: 0, vectorWidth, vectorHeight,
    });
    this.drag = { start, current: start };
    this.setState({ rect: getRectFromCornerCoordinates(start, start) });
  }

  mouseHandler(event) {
    if (!this.drag) return;
    if (event.type === 'cancel') { this.drag = null; this.setState({ rect: null }); return; }
    if (event.type === 'mousemove' || (event.type === 'mouseup' && Number.isFinite(getTouch(event).pageX))) {
      this.drag.current = this.props.constrainResize({
        originalMovingCorner: this.drag.current, startCorner: this.drag.start,
        movingCorner: this.props.getPlaneCoordinatesFromEvent(event), lockedDimension: null,
        vectorWidth: this.props.vectorWidth, vectorHeight: this.props.vectorHeight,
      });
      this.setState({ rect: getRectFromCornerCoordinates(this.drag.start, this.drag.current) });
    }
    if (event.type === 'mouseup') {
      const rect = getRectFromCornerCoordinates(this.drag.start, this.drag.current);
      this.drag = null;
      this.setState({ rect: null });
      if (rect.width && rect.height) this.props.onAddShape(rect);
    }
  }

  render() {
    const { DrawPreviewComponent, vectorWidth, vectorHeight, disabled } = this.props;
    return (
      <>
        <Rect
          testID="draw-layer" width={vectorWidth} height={vectorHeight} fill="transparent"
          pointerEvents={disabled ? 'none' : 'auto'}
          {...getGestureHandlers(event => this.start(event), { ...this.props.callbacks, handler: this.mouseHandler }, !disabled)}
        />
        {this.state.rect && (
          <DrawPreviewComponent {...this.state.rect} disabled isInternalComponent shapeId="rse-internal-draw-component" />
        )}
      </>
    );
  }
}

DrawLayer.propTypes = { onAddShape: PropTypes.func.isRequired };
DrawLayer.defaultProps = {
  disabled: false, constrainMove: defaultConstrainMove, constrainResize: defaultConstrainResize,
  DrawPreviewComponent: DefaultDrawPreviewComponent,
};
export default withContext(DrawLayer);
