import * as React from 'react';
import type { GestureResponderEvent, ImageURISource, ViewProps } from 'react-native';
import type { GProps, ImageProps, SvgProps } from 'react-native-svg';

export interface Point { x: number; y: number }
export interface ShapeRect extends Point { width: number; height: number; rotation?: number }
export interface MoveConstraintInput extends ShapeRect { originalX: number; originalY: number; vectorWidth?: number; vectorHeight?: number }
export interface ResizeConstraintInput {
  originalMovingCorner: Point; startCorner: Point; movingCorner: Point;
  lockedDimension: 'x' | 'y' | null; vectorWidth?: number; vectorHeight?: number;
}
export interface EditorEvent {
  nativeEvent?: GestureResponderEvent['nativeEvent'];
  type?: string; key?: string; shiftKey?: boolean; defaultPrevented?: boolean;
  preventDefault?(): void; stopPropagation?(): void;
}
export interface ShapeRenderProps extends ShapeRect {
  shapeId: string; scale: number; rotation: number; disabled: boolean;
  active: boolean; nativeActive: boolean; isBeingChanged: boolean; isInSelectionGroup: boolean;
}
export type GestureHandlers = Pick<ViewProps,
  'onStartShouldSetResponder' | 'onResponderGrant' | 'onResponderMove' |
  'onResponderEnd' | 'onResponderRelease' | 'onResponderTerminate' | 'onResponderTerminationRequest'>;
export interface HandleProps extends Point {
  name: string; active: boolean; nativeActive: boolean; isInSelectionGroup: boolean;
  scale: number; cursor: string; recommendedSize: number; gestureHandlers: GestureHandlers;
  /** Compatibility alias for gestureHandlers.onResponderGrant; prefer spreading gestureHandlers. */
  onMouseDown(event: GestureResponderEvent): void;
}
export interface RotateHandleProps extends HandleProps {
  radius: number; onDoubleClick(): void;
}
export interface WrappedShapeProps<P extends object = object> extends ShapeRect {
  shapeId: string; active?: boolean | null; disabled?: boolean; isInSelectionGroup?: boolean;
  isInternalComponent?: boolean; keyboardTransformMultiplier?: number; handleSize?: number;
  rotationSpeed?: number; wrapperProps?: GProps;
  constrainMove?(input: MoveConstraintInput): Point;
  constrainResize?(input: ResizeConstraintInput): Point;
  onChange?(rect: ShapeRect, props: WrappedShapeProps<P> & P): void;
  onIntermediateChange?(rect: ShapeRect): void;
  onTransformCancel?(): void;
  onDelete?(event: EditorEvent, props: WrappedShapeProps<P> & P): void;
  onFocus?(event: EditorEvent, props: WrappedShapeProps<P> & P): void;
  onBlur?(event: EditorEvent, props: WrappedShapeProps<P> & P): void;
  onKeyDown?(event: EditorEvent, props: WrappedShapeProps<P> & P): void;
  ResizeHandleComponent?: React.ComponentType<HandleProps>;
  RotateHandleComponent?: React.ComponentType<RotateHandleProps>;
}
export interface ShapeHandle {
  forceFocus(event?: EditorEvent): void;
  keyboardMove(dx: number, dy: number): void;
  keyboardResize(dw: number, dh: number): void;
  resetRotation(): void;
  deleteShape(event?: EditorEvent): void;
  cancelTransform(): void;
  simulateTransform(rect: ShapeRect | null): void;
  handleKeyDown(event: EditorEvent): void;
}
export function wrapShape<P extends object = object>(
  component: React.ComponentType<ShapeRenderProps & P>
): React.ForwardRefExoticComponent<React.PropsWithoutRef<WrappedShapeProps<P> & P> & React.RefAttributes<ShapeHandle>>;

export interface ShapeEditorProps extends ViewProps {
  children?: React.ReactNode; vectorWidth?: number; vectorHeight?: number;
  /** Finite, positive display scale. Shape coordinates remain in vector units. */
  scale?: number; focusOnAdd?: boolean; focusOnDelete?: boolean;
  svgProps?: Omit<SvgProps, 'children' | 'width' | 'height' | 'viewBox'>;
}
export class ShapeEditor extends React.Component<ShapeEditorProps> {
  focusShapeById(shapeId: string): void;
  moveActiveShape(dx: number, dy: number): void;
  resizeActiveShape(dw: number, dh: number): void;
  deleteActiveShape(event?: EditorEvent): void;
  handleKeyDown(event: EditorEvent): void;
  cancelGesture(): void;
  clearFocus(event?: EditorEvent): void;
}
export interface ImageLayerProps extends Omit<ImageProps, 'href' | 'onLoad' | 'onError'> {
  src: string | number | ImageURISource;
  onLoad?(dimensions: { naturalWidth: number; naturalHeight: number }): void;
  onError?(error: unknown): void;
}
export class ImageLayer extends React.Component<ImageLayerProps> {}
export interface DrawLayerProps {
  onAddShape(rect: ShapeRect): void; disabled?: boolean;
  constrainMove?(input: MoveConstraintInput): Point;
  constrainResize?(input: ResizeConstraintInput): Point;
  DrawPreviewComponent?: React.ComponentType<WrappedShapeProps>;
}
export const DrawLayer: React.ComponentType<DrawLayerProps>;
export interface SelectionLayerProps {
  children?: React.ReactNode; selectedShapeIds: string[];
  onSelectionChange(ids: string[]): void;
  /** Multiple mode toggles touched shapes without a Shift key. Switch to single to drag the group. */
  selectionMode?: 'single' | 'multiple';
  onChange?(rects: ShapeRect[], props: WrappedShapeProps[]): void;
  onDelete?(event: EditorEvent, props: WrappedShapeProps[]): void;
  keyboardTransformMultiplier?: number; minimumDistanceForSelection?: number;
  SelectionComponent?: React.ComponentType<WrappedShapeProps>;
  SelectionDrawComponent?: React.ComponentType<WrappedShapeProps>;
  selectionComponentProps?: Partial<WrappedShapeProps>;
}
export interface SelectionLayerHandle {
  deleteSelection(event?: EditorEvent): void;
  moveSelection(dx: number, dy: number): void;
  resizeSelection(dw: number, dh: number): void;
}
export const SelectionLayer: React.ForwardRefExoticComponent<SelectionLayerProps & React.RefAttributes<SelectionLayerHandle>>;
