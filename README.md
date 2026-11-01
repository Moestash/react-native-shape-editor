# React Native Shape Editor

A controlled SVG editor for shapes, notes, and image annotations on iOS and Android.

```js
import { ShapeEditor, wrapShape, ImageLayer, DrawLayer, SelectionLayer } from 'react-native-shape-editor';
```

Move, resize with eight handles, rotate, draw new shapes, select multiple shapes, and transform or delete groups. Movement and resize constraints, custom shapes/handles/previews, scaled coordinates, focus callbacks, and intermediate previews are supported. 

## Components and API

### ShapeEditor

Renders a measurable native `View` containing an SVG canvas. All layers and shapes go inside it. Other props (such as `testID`, `onLayout`, and accessibility props) go to the outer `View`.

| Prop | Default | Meaning |
| --- | --- | --- |
| `vectorWidth`, `vectorHeight` | `0` | Canvas dimensions in vector units. Set these explicitly, or from image dimensions. |
| `scale` | `1` | Finite positive display scale. Native size is vector dimensions × scale. |
| `focusOnAdd` | `true` | Logically focus the last newly added enabled shape. Initial shapes are not focused. |
| `focusOnDelete` | `true` | Focus the nearest remaining enabled shape by center after deletion. |
| `style` | — | Native View style, including registered styles and arrays. Use `scale` for canvas sizing; width/height or padding overrides do not resize the SVG. |
| `svgProps` | `{}` | Additional SVG canvas props. Width, height, and viewBox are managed by the editor. |

Ref methods: `focusShapeById(id)`, `clearFocus()`, `moveActiveShape(dx, dy)`, `resizeActiveShape(dw, dh)`, `deleteActiveShape(event?)`, `handleKeyDown(event)`, and `cancelGesture()`.

### wrapShape(Component)

Wrap a component that draws at its local origin `(0, 0)`. The wrapper positions and rotates it. Do not apply `x`/`y` a second time to the shape's SVG element.

Required props: `shapeId` (unique string), `x`, `y`, `width`, `height` (numbers).

| Prop | Default | Meaning |
| --- | --- | --- |
| `onChange(rect, props)` | no-op | Commit movement, resizing, rotation, or a command. Update your saved data for changes to persist. Rect includes `x`, `y`, `width`, `height`, `rotation`. |
| `rotation` | `0` | Angle in degrees around the shape center. |
| `rotationSpeed` | `1` | Multiplier for dragged angular changes. |
| `active` | logical focus | Override the visual active flag. Selection layers provide it automatically. |
| `disabled` | `false` | Disables all interactions and handles; excludes the shape from selection transforms. |
| `isInSelectionGroup` | automatic in selection | Flag forwarded to shape/handles. Default handles hide for group members. |
| `constrainMove(input)` | unrestricted | Return `{x, y}` for the proposed position. Input: `{originalX, originalY, x, y, width, height}`. |
| `constrainResize(input)` | unrestricted | Return the moving corner `{x, y}`. Input: `{originalMovingCorner, startCorner, movingCorner, lockedDimension}`. Dimension lock is `"x"`, `"y"`, or `null`. |
| `handleSize` | `20` | Recommended handle size in display points; kept constant as scale changes. |
| `keyboardTransformMultiplier` | `1` | Step multiplier for keyboard and imperative move/resize commands. |
| `onIntermediateChange(rect)` | no-op | Preview updates during a gesture. |
| `onTransformCancel()` | no-op | Clear any external preview on cancellation. |
| `onDelete(event, props)` | no-op | Request deletion. Remove the shape in your controlled data. |
| `onFocus`, `onBlur`, `onKeyDown` | no-op | Called as `(event, props)`. Calling `preventDefault()` in `onKeyDown` overrides default shortcuts. |
| `ResizeHandleComponent`, `RotateHandleComponent` | built-in SVG handles | Custom native handle components. See below. |
| `wrapperProps` | `{}` | Props for the native SVG `G`, such as opacity or testID. Managed transform and responder handlers take precedence. |

The inner component receives custom props plus `width`, `height`, `x`, `y`, `rotation`, `shapeId`, `scale`, `disabled`, `active`, `nativeActive`, `isInSelectionGroup`, and `isBeingChanged`. `x` and `y` remain the controlled coordinates; width/height/rotation reflect the current preview.

Ref methods: `forceFocus()`, `keyboardMove(dx, dy)`, `keyboardResize(dw, dh)`, `resetRotation()`, `deleteShape(event?)`, `handleKeyDown(event)`, `cancelTransform()`, and `simulateTransform(rectOrNull)`.

### DrawLayer

| Prop | Default | Meaning |
| --- | --- | --- |
| `onAddShape(rect)` | **required** | Add the completed rectangle to your controlled data. |
| `disabled` | `false` | Let touches pass through when disabled. |
| `constrainMove`, `constrainResize` | unrestricted | Same signatures as wrapped shapes; also receive `vectorWidth` and `vectorHeight`. Start movement is constrained with zero dimensions. |
| `DrawPreviewComponent` | translucent blue rectangle | A `wrapShape` component used while drawing. |

### SelectionLayer

Wrap selectable shapes in this component. Controlled props: `selectedShapeIds` (string array) and `onSelectionChange(ids)` are required. Selected state and group handle visibility are injected into wrapped shapes automatically; explicit `active`/`isInSelectionGroup` overrides are still supported.

| Prop | Default | Meaning |
| --- | --- | --- |
| `selectionMode` | `"single"` | `"multiple"` toggles individual shapes with a touch; a marquee adds to the existing selection. Switch to `"single"` for group dragging. |
| `onChange(rects, shapesProps)` | no-op | Commit a transform of the group. Arrays correspond by index. Each child's movement/resize constraints and rotation are respected. |
| `onDelete(event, shapesProps)` | no-op | Delete the selected enabled shapes in your data. |
| `minimumDistanceForSelection` | `15` | Marquee must reach this width **or** height in vector units. |
| `keyboardTransformMultiplier` | `1` | Step multiplier for group commands. |
| `SelectionComponent` | outlined rectangle | A `wrapShape` component for the group outline and handles. |
| `SelectionDrawComponent` | translucent blue rectangle | A `wrapShape` component for the marquee preview. |
| `selectionComponentProps` | `{}` | Extra props, including constraints and custom handles, for the group wrapper. |

Ref methods `moveSelection(dx, dy)`, `resizeSelection(dw, dh)`, and `deleteSelection(event?)` work for a single selected shape or a group. Group move/resize commands respect each child's constraints; constraints on `selectionComponentProps` apply to direct manipulation of the group wrapper. Marquee intersection and group bounds use the axis-aligned bounding boxes of rotated shapes. Multiple-selection taps use inverse-rotated rectangle hit testing, with the last registered matching shape taking precedence (custom paths are selected by their rectangle).

### ImageLayer

Renders an SVG background image. `src` accepts a URI string, a React Native `require('./image.png')` asset, or `{uri, headers?, width?, height?}`.

`onLoad({naturalWidth, naturalHeight})` reports source dimensions. Use it to set canvas vector dimensions. `onError(error)` reports load/measurement failures. Stale requests and requests completing after unmount are ignored. Additional SVG image props (e.g. `x`, `y`, `width`, `height`, `preserveAspectRatio`) are forwarded. Images do not intercept shape gestures by default.

### Custom handles

Custom handle components receive `name`, `x`, `y`, `scale`, `recommendedSize`, `active`, `nativeActive`, `isInSelectionGroup`, and `gestureHandlers`. Rotation handles also receive `radius` and an `onDoubleClick` compatibility callback for resetting rotation.

**Spread the complete `gestureHandlers` onto the SVG element.** They capture grant, move, release, and termination. Do not also assign `onPress`/`onPressIn` on the same SVG node (including through `wrapperProps`): SVG's touchable implementation replaces raw responder handlers. The old `onMouseDown` prop remains an alias for starting a gesture, but alone is insufficient for mobile dragging.

```jsx
const Handle = ({ x, y, recommendedSize, gestureHandlers, isInSelectionGroup }) => (
  isInSelectionGroup ? null : <Rect
    {...gestureHandlers}
    x={x - recommendedSize / 2} y={y - recommendedSize / 2}
    width={recommendedSize} height={recommendedSize} fill="purple"
  />
);
```
