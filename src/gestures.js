export function gestureEvent(event, type) {
  if (event.persist) event.persist();
  const nativeEvent = event.nativeEvent || event;
  return {
    nativeEvent: { ...nativeEvent, touches: nativeEvent.touches && [...nativeEvent.touches], changedTouches: nativeEvent.changedTouches && [...nativeEvent.changedTouches] },
    type,
    key: event.key || nativeEvent.key,
    shiftKey: event.shiftKey || nativeEvent.shiftKey || false,
    defaultPrevented: event.defaultPrevented || false,
    stopPropagation: () => event.stopPropagation && event.stopPropagation(),
    preventDefault() {
      this.defaultPrevented = true;
      if (event.preventDefault) event.preventDefault();
    },
  };
}

export function getGestureHandlers(onStart, callbacks, enabled = true) {
  return {
    onStartShouldSetResponder: () => enabled,
    onResponderGrant: event => {
      if (!enabled) return false;
      if (event.stopPropagation) event.stopPropagation();
      callbacks.startGesture(onStart, gestureEvent(event, 'mousedown'), callbacks.handler);
      // Match PanResponder: block native scrolling from joining this drag.
      return true;
    },
    onResponderMove: event => callbacks.onGestureEvent(gestureEvent(event, 'mousemove')),
    onResponderEnd: event => callbacks.onGestureEnd(gestureEvent(event, 'mouseup')),
    onResponderRelease: event => callbacks.onGestureEvent(gestureEvent(event, 'mouseup')),
    onResponderTerminate: event => callbacks.onGestureEvent(gestureEvent(event, 'cancel')),
    onResponderTerminationRequest: () => false,
  };
}

export function getTouch(event, identifier) {
  const nativeEvent = event.nativeEvent || event;
  const touches = [...(nativeEvent.touches || []), ...(nativeEvent.changedTouches || [])];
  return touches.find(touch => touch.identifier === identifier) || touches[0] || nativeEvent;
}
