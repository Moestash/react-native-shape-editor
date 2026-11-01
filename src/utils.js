export function getRectFromCornerCoordinates(corner1, corner2, rotation = 0) {
  return {
    x: Math.min(corner1.x, corner2.x),
    y: Math.min(corner1.y, corner2.y),
    width: Math.abs(corner1.x - corner2.x),
    height: Math.abs(corner1.y - corner2.y),
    rotation,
  };
}

export const defaultConstrainMove = ({ x, y }) => ({ x, y });
export const defaultConstrainResize = ({ movingCorner }) => movingCorner;

export function rotatePoint(point, center, degrees) {
  const angle = degrees * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: center.x + (point.x - center.x) * cos - (point.y - center.y) * sin,
    y: center.y + (point.x - center.x) * sin + (point.y - center.y) * cos,
  };
}

export const rectCenter = rect => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });

export function getBounds(rect) {
  const center = rectCenter(rect);
  const corners = [
    { x: rect.x, y: rect.y }, { x: rect.x + rect.width, y: rect.y },
    { x: rect.x, y: rect.y + rect.height }, { x: rect.x + rect.width, y: rect.y + rect.height },
  ].map(point => rotatePoint(point, center, rect.rotation || 0));
  const x = Math.min(...corners.map(point => point.x));
  const y = Math.min(...corners.map(point => point.y));
  return {
    x, y,
    width: Math.max(...corners.map(point => point.x)) - x,
    height: Math.max(...corners.map(point => point.y)) - y,
  };
}

export function containsPoint(rect, point) {
  const local = rotatePoint(point, rectCenter(rect), -(rect.rotation || 0));
  return local.x >= rect.x && local.x <= rect.x + rect.width &&
    local.y >= rect.y && local.y <= rect.y + rect.height;
}

// Account for the center moving during a resize, keeping the opposite corner fixed.
export function getRotatedResizeRect(start, end, original) {
  const rect = getRectFromCornerCoordinates(start, end, original.rotation || 0);
  const center = rotatePoint(rectCenter(rect), rectCenter(original), original.rotation || 0);
  return { ...rect, x: center.x - rect.width / 2, y: center.y - rect.height / 2 };
}
