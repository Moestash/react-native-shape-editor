import React, { createRef } from 'react';
import { Rect } from 'react-native-svg';
import { ShapeEditor, wrapShape, SelectionLayer, DrawLayer, ImageLayer, ShapeRenderProps,
  ShapeHandle, SelectionLayerHandle, HandleProps, ShapeRect } from '..';

const Note = wrapShape(({ width, height, text }: ShapeRenderProps & { text: string }) => <Rect width={width} height={height} accessibilityLabel={text} />);
const shape = createRef<ShapeHandle>();
const selection = createRef<SelectionLayerHandle>();
const editor = createRef<ShapeEditor>();
const CustomHandle = ({ gestureHandlers, x, y, recommendedSize }: HandleProps) => <Rect {...gestureHandlers} x={x} y={y} width={recommendedSize} height={recommendedSize} />;
const update = (rects: ShapeRect[]) => rects;
const example = <ShapeEditor ref={editor} vectorWidth={400} vectorHeight={600} style={[{ backgroundColor: 'white' }]}>
  <ImageLayer src={{ uri: 'https://example.com/image.png' }} onLoad={({ naturalWidth }) => naturalWidth} />
  <SelectionLayer ref={selection} selectedShapeIds={[]} onSelectionChange={() => {}} onChange={update} selectionMode="multiple">
    <DrawLayer onAddShape={rect => update([rect])} />
    <Note ref={shape} x={0} y={0} width={100} height={80} shapeId="a" text="note" ResizeHandleComponent={CustomHandle} onChange={(rect, props) => { props.text.toUpperCase(); update([rect]); }} />
  </SelectionLayer>
</ShapeEditor>;
editor.current?.handleKeyDown({ key: 'ArrowRight', shiftKey: true });
selection.current?.moveSelection(10, 0);
shape.current?.resetRotation();
// @ts-expect-error shape geometry is mandatory
const invalid = <Note shapeId="b" text="missing geometry" />;
