import React, { createRef } from 'react';
import { create, act } from 'react-test-renderer';
import { Rect } from 'react-native-svg';
import { Image, __measure } from 'react-native';
import { ShapeEditor, wrapShape, DrawLayer, SelectionLayer, ImageLayer } from '../index';
import { containsPoint, getBounds, rotatePoint, rectCenter } from '../utils';

const Shape = wrapShape(({ width, height }) => <Rect width={width} height={height} fill="blue" />);
const rect = { shapeId: 'a', x: 10, y: 20, width: 100, height: 80 };
const mounted = [];
const make = element => {
  let renderer;
  act(() => { renderer = create(element); });
  mounted.push(renderer);
  return renderer;
};
const byId = (renderer, id) => renderer.root.findAll(node => typeof node.type === 'string' && node.props.testID === id)[0];
const touch = (x, y, scale = 1, extras = {}) => ({
  nativeEvent: { pageX: 90 + x * scale, pageY: 120 + y * scale, identifier: 1, ...extras },
  stopPropagation: jest.fn(), preventDefault: jest.fn(),
});
const send = (target, name, event) => act(() => { target.props[name](event); });
const drag = (target, from, to, scale = 1) => {
  send(target, 'onResponderGrant', touch(...from, scale));
  send(target, 'onResponderMove', touch(...to, scale));
  send(target, 'onResponderRelease', touch(...to, scale));
};
afterEach(() => {
  act(() => mounted.splice(0).forEach(renderer => renderer.unmount()));
  jest.clearAllMocks();
});

test('native SVG exports, drawing in every direction and vector scaling', () => {
  const add = jest.fn();
  const renderer = make(<ShapeEditor vectorWidth={300} vectorHeight={400} scale={2}><DrawLayer onAddShape={add} /></ShapeEditor>);
  expect(renderer.root.findByType('Svg').props.viewBox).toBe('0 0 300 400');
  drag(byId(renderer, 'draw-layer'), [100, 120], [30, 50], 2);
  expect(add).toHaveBeenCalledWith({ x: 30, y: 50, width: 70, height: 70, rotation: 0 });
  drag(byId(renderer, 'draw-layer'), [20, 20], [20, 90], 2);
  expect(add).toHaveBeenCalledTimes(1);
});

test('drawing applies start/resize constraints and cancellation does not add a shape', () => {
  const add = jest.fn();
  const renderer = make(<ShapeEditor><DrawLayer onAddShape={add}
    constrainMove={({ x, y }) => ({ x: Math.round(x / 10) * 10, y })}
    constrainResize={({ movingCorner }) => ({ ...movingCorner, y: 100 })} /></ShapeEditor>);
  const layer = byId(renderer, 'draw-layer');
  drag(layer, [23, 20], [80, 80]);
  expect(add.mock.calls[0][0]).toMatchObject({ x: 20, y: 20, width: 60, height: 80 });
  send(layer, 'onResponderGrant', touch(0, 0));
  send(layer, 'onResponderMove', touch(50, 50));
  send(layer, 'onResponderTerminate', touch(50, 50));
  expect(add).toHaveBeenCalledTimes(1);
});

test('movement preserves rotation, previews immediately, commits once and respects constraints', () => {
  const change = jest.fn();
  const intermediate = jest.fn();
  const renderer = make(<ShapeEditor scale={0.5}><Shape {...rect} rotation={30} onChange={change} onIntermediateChange={intermediate}
    constrainMove={({ x, y }) => ({ x: Math.min(50, x), y })} /></ShapeEditor>);
  const shape = byId(renderer, 'shape-a');
  send(shape, 'onResponderGrant', touch(15, 25, 0.5));
  send(shape, 'onResponderMove', touch(105, 125, 0.5));
  expect(byId(renderer, 'shape-a').props.transform).toContain('translate(50,120)');
  send(shape, 'onResponderRelease', touch(105, 125, 0.5));
  expect(change).toHaveBeenCalledTimes(1);
  expect(change.mock.calls[0][0]).toEqual({ x: 50, y: 120, width: 100, height: 80, rotation: 30 });
  expect(intermediate).toHaveBeenCalled();
});

test.each([
  ['nw', [10, 20], [0, 0], { x: 0, y: 0, width: 110, height: 100 }],
  ['ne', [110, 20], [130, 0], { x: 10, y: 0, width: 120, height: 100 }],
  ['sw', [10, 100], [0, 130], { x: 0, y: 20, width: 110, height: 110 }],
  ['se', [110, 100], [130, 130], { x: 10, y: 20, width: 120, height: 110 }],
  ['n', [60, 20], [80, 0], { x: 10, y: 0, width: 100, height: 100 }],
  ['s', [60, 100], [80, 130], { x: 10, y: 20, width: 100, height: 110 }],
  ['w', [10, 60], [0, 80], { x: 0, y: 20, width: 110, height: 80 }],
  ['e', [110, 60], [130, 80], { x: 10, y: 20, width: 120, height: 80 }],
])('resizes the %s handle with edge dimension locks', (name, from, to, expected) => {
  const change = jest.fn();
  const renderer = make(<ShapeEditor><Shape {...rect} onChange={change} /></ShapeEditor>);
  drag(byId(renderer, `resize-${name}`), from, to);
  expect(change.mock.calls[0][0]).toEqual({ ...expected, rotation: 0 });
});

test('resizing across the anchor flips the rectangle without negative dimensions', () => {
  const change = jest.fn();
  const renderer = make(<ShapeEditor><Shape {...rect} onChange={change} /></ShapeEditor>);
  drag(byId(renderer, 'resize-se'), [110, 100], [0, 0]);
  expect(change.mock.calls[0][0]).toMatchObject({ x: 0, y: 0, width: 10, height: 20 });
});

test('rotated resize keeps its opposite corner fixed at non-unit zoom', () => {
  const change = jest.fn();
  const original = { ...rect, rotation: 90 };
  const center = rectCenter(original);
  const from = rotatePoint({ x: 110, y: 100 }, center, 90);
  const to = rotatePoint({ x: 150, y: 130 }, center, 90);
  const renderer = make(<ShapeEditor scale={2}><Shape {...original} onChange={change} /></ShapeEditor>);
  drag(byId(renderer, 'resize-se'), [from.x, from.y], [to.x, to.y], 2);
  const next = change.mock.calls[0][0];
  expect(next.width).toBeCloseTo(140);
  expect(next.height).toBeCloseTo(110);
  const anchorBefore = rotatePoint({ x: rect.x, y: rect.y }, center, 90);
  const anchorAfter = rotatePoint({ x: next.x, y: next.y }, rectCenter(next), 90);
  expect(anchorAfter.x).toBeCloseTo(anchorBefore.x);
  expect(anchorAfter.y).toBeCloseTo(anchorBefore.y);
});

test('rotation uses editor coordinates and controlled rotation; double tap resets', () => {
  const change = jest.fn();
  const ref = createRef();
  const render = rotation => <ShapeEditor scale={2}><Shape ref={ref} {...rect} rotation={rotation} onChange={change} /></ShapeEditor>;
  const renderer = make(render(20));
  drag(byId(renderer, 'rotate-handle'), [60, 10], [110, 60], 2);
  expect(change.mock.calls[0][0].rotation).toBeCloseTo(110);
  act(() => renderer.update(render(45)));
  expect(byId(renderer, 'shape-a').props.transform).toContain('rotate(45,');
  const handle = byId(renderer, 'rotate-handle');
  send(handle, 'onResponderGrant', touch(60, 10, 2, { timestamp: 1000 }));
  send(handle, 'onResponderRelease', touch(60, 10, 2, { timestamp: 1001 }));
  send(handle, 'onResponderGrant', touch(60, 10, 2, { timestamp: 1100 }));
  expect(change.mock.calls.at(-1)[0].rotation).toBe(0);
});

test('cancellation restores previews and disabled shapes cannot mutate through refs', () => {
  const ref = createRef();
  const change = jest.fn();
  const renderer = make(<ShapeEditor><Shape {...rect} ref={ref} onChange={change} /></ShapeEditor>);
  const shape = byId(renderer, 'shape-a');
  send(shape, 'onResponderGrant', touch(15, 25));
  send(shape, 'onResponderMove', touch(55, 65));
  send(shape, 'onResponderTerminate', touch(55, 65));
  expect(byId(renderer, 'shape-a').props.transform).toContain('translate(10,20)');
  expect(change).not.toHaveBeenCalled();
  act(() => renderer.update(<ShapeEditor><Shape {...rect} ref={ref} disabled onChange={change} /></ShapeEditor>));
  act(() => { ref.current.keyboardMove(10, 10); ref.current.keyboardResize(10, 10); ref.current.resetRotation(); });
  expect(change).not.toHaveBeenCalled();
  expect(byId(renderer, 'shape-a').props.onStartShouldSetResponder()).toBe(false);
});

test('measurement is refreshed per gesture and queued move/release survive async measurement', () => {
  const change = jest.fn();
  let measured;
  __measure.mockImplementationOnce(callback => { measured = callback; });
  const renderer = make(<ShapeEditor><Shape {...rect} onChange={change} /></ShapeEditor>);
  const shape = byId(renderer, 'shape-a');
  send(shape, 'onResponderGrant', touch(15, 25));
  send(shape, 'onResponderMove', touch(35, 45));
  send(shape, 'onResponderRelease', touch(35, 45));
  expect(change).not.toHaveBeenCalled();
  act(() => measured(0, 0, 500, 500, 90, 120));
  expect(change.mock.calls[0][0]).toMatchObject({ x: 30, y: 40 });
  __measure.mockImplementationOnce(callback => callback(0, 0, 500, 500, 100, 130));
  drag(shape, [25, 35], [45, 55]);
  expect(change.mock.calls[1][0]).toMatchObject({ x: 30, y: 40 });
});

test('native toolbar commands, keyboard overrides and focus/blur callbacks', () => {
  const editor = createRef();
  const change = jest.fn();
  const remove = jest.fn();
  const blur = jest.fn();
  const onKeyDown = jest.fn(event => { if (event.key === 'ArrowLeft') event.preventDefault(); });
  make(<ShapeEditor ref={editor}><Shape {...rect} onChange={change} onDelete={remove} onBlur={blur} onKeyDown={onKeyDown} />
    <Shape {...rect} shapeId="b" /></ShapeEditor>);
  act(() => editor.current.focusShapeById('a'));
  act(() => editor.current.handleKeyDown({ key: 'ArrowRight' }));
  expect(change.mock.calls[0][0].x).toBe(11);
  act(() => editor.current.handleKeyDown({ key: 'ArrowLeft' }));
  expect(change).toHaveBeenCalledTimes(1);
  act(() => editor.current.handleKeyDown({ key: 'ArrowDown', shiftKey: true }));
  expect(change.mock.calls[1][0].height).toBe(81);
  act(() => editor.current.deleteActiveShape());
  expect(remove).toHaveBeenCalledTimes(1);
  act(() => editor.current.focusShapeById('b'));
  expect(blur).toHaveBeenCalledTimes(1);
});

function selectionFixture({ initial = [], mode = 'single', extraProps = {}, shapeProps = {} } = {}) {
  const change = jest.fn();
  const selection = jest.fn();
  const remove = jest.fn();
  const selectionRef = createRef();
  function Fixture() {
    const [ids, setIds] = React.useState(initial);
    return <ShapeEditor vectorWidth={400} vectorHeight={400}>
      <SelectionLayer ref={selectionRef} selectedShapeIds={ids} selectionMode={mode}
        onSelectionChange={next => { selection(next); setIds(next); }} onChange={change} onDelete={remove} {...extraProps}>
        <Shape {...rect} {...shapeProps} />
        <Shape {...rect} shapeId="b" x={210} rotation={10} />
        <Shape {...rect} shapeId="locked" x={0} disabled />
      </SelectionLayer>
    </ShapeEditor>;
  }
  return { renderer: make(<Fixture />), change, selection, remove, selectionRef };
}

test('marquee selects intersecting shapes, excludes disabled shapes, and can cancel', () => {
  const { renderer, selection } = selectionFixture();
  drag(byId(renderer, 'selection-layer'), [0, 0], [330, 130]);
  expect(selection.mock.calls.at(-1)[0]).toEqual(['a', 'b']);
  expect(byId(renderer, 'shape-rse-internal-selection-component')).toBeDefined();
  send(byId(renderer, 'selection-layer'), 'onResponderGrant', touch(0, 0));
  send(byId(renderer, 'selection-layer'), 'onResponderTerminate', touch(1, 1));
  expect(selection.mock.calls.at(-1)[0]).toEqual(['a', 'b']);
});

test('mobile multiple-selection toggles shapes behind the group overlay geometrically', () => {
  const { renderer, selection } = selectionFixture({ mode: 'multiple' });
  send(byId(renderer, 'shape-a'), 'onResponderGrant', touch(50, 50));
  send(byId(renderer, 'shape-a'), 'onResponderRelease', touch(50, 50));
  send(byId(renderer, 'shape-b'), 'onResponderGrant', touch(250, 50));
  send(byId(renderer, 'shape-b'), 'onResponderRelease', touch(250, 50));
  expect(selection.mock.calls.at(-1)[0]).toEqual(['a', 'b']);
  send(byId(renderer, 'shape-rse-internal-selection-component'), 'onResponderGrant', touch(50, 50));
  expect(selection.mock.calls.at(-1)[0]).toEqual(['b']);
});

test('group movement, resize, rotation and deletion retain child rotations and constraints', () => {
  const { renderer, change, remove, selectionRef } = selectionFixture({ initial: ['a', 'b'], shapeProps: {
    constrainMove: ({ x, y }) => ({ x: Math.min(20, x), y }),
  } });
  const group = byId(renderer, 'shape-rse-internal-selection-component');
  drag(group, [150, 60], [180, 100]);
  const moved = change.mock.calls[0][0];
  expect(moved[0].x).toBe(20);
  expect(moved[0].y).toBeCloseTo(60);
  expect(moved[1].rotation).toBe(10);
  act(() => selectionRef.current.resizeSelection(50, 20));
  expect(change.mock.calls[1][0][0].width).toBeGreaterThan(100);
  const bounds = [getBounds(rect), getBounds({ ...rect, x: 210, rotation: 10 })];
  const x = Math.min(...bounds.map(b => b.x));
  const y = Math.min(...bounds.map(b => b.y));
  const w = Math.max(...bounds.map(b => b.x + b.width)) - x;
  const h = Math.max(...bounds.map(b => b.y + b.height)) - y;
  const center = { x: x + w / 2, y: y + h / 2 };
  const rotateHandle = group.findAll(node => node.type === 'Circle')[0];
  drag(rotateHandle, [center.x, y - 50], [center.x + 100, center.y]);
  expect(change.mock.calls.at(-1)[0][0].rotation).toBeCloseTo(90);
  expect(change.mock.calls.at(-1)[0][1].rotation).toBeCloseTo(100);
  act(() => selectionRef.current.deleteSelection());
  expect(remove.mock.calls[0][1].map(props => props.shapeId)).toEqual(['a', 'b']);
});

test('cancelling group edits restores every child preview', () => {
  const { renderer, change } = selectionFixture({ initial: ['a', 'b'] });
  const group = byId(renderer, 'shape-rse-internal-selection-component');
  send(group, 'onResponderGrant', touch(150, 60));
  send(group, 'onResponderMove', touch(180, 100));
  expect(byId(renderer, 'shape-a').props.transform).toContain('translate(40,60)');
  send(group, 'onResponderTerminate', touch(180, 100));
  expect(byId(renderer, 'shape-a').props.transform).toContain('translate(10,20)');
  expect(change).not.toHaveBeenCalled();
});

test('focus on add and nearest remaining shape on delete', () => {
  const focus = jest.fn();
  const render = ids => <ShapeEditor>{ids.map((id, i) => <Shape {...rect} shapeId={id} x={i * 200} key={id} onFocus={() => focus(id)} />)}</ShapeEditor>;
  const renderer = make(render(['a']));
  act(() => renderer.update(render(['a', 'b', 'c'])));
  expect(focus).toHaveBeenLastCalledWith('c');
  act(() => renderer.update(render(['a', 'b'])));
  expect(focus).toHaveBeenLastCalledWith('b');
});

test('unchanged sibling shapes do not re-render, including inside a selection layer', () => {
  const innerA = jest.fn(({ width, height }) => <Rect width={width} height={height} />);
  const innerB = jest.fn(({ width, height }) => <Rect width={width} height={height} />);
  const A = wrapShape(innerA);
  const B = wrapShape(innerB);
  const ids = [];
  const selectionChanged = () => {};
  const render = (width, group) => {
    const children = <><A {...rect} /><B {...rect} shapeId="b" width={width} /></>;
    return <ShapeEditor>{group ? <SelectionLayer selectedShapeIds={ids} onSelectionChange={selectionChanged}>{children}</SelectionLayer> : children}</ShapeEditor>;
  };
  [false, true].forEach(group => {
    const renderer = make(render(100, group));
    innerA.mockClear(); innerB.mockClear();
    act(() => renderer.update(render(200, group)));
    expect(innerA).not.toHaveBeenCalled();
    expect(innerB).toHaveBeenCalledTimes(1);
  });
});

test('native image dimensions support URI, local assets, headers, errors, and stale loads', () => {
  const load = jest.fn();
  const error = jest.fn();
  const requests = [];
  Image.getSize.mockImplementation((uri, success, failure) => requests.push({ uri, success, failure }));
  const renderer = make(<ImageLayer src="old.png" onLoad={load} onError={error} />);
  act(() => renderer.update(<ImageLayer src="new.png" onLoad={load} onError={error} />));
  act(() => requests[0].success(1, 1));
  expect(load).not.toHaveBeenCalled();
  act(() => requests[1].success(300, 400));
  expect(load).toHaveBeenCalledWith({ naturalWidth: 300, naturalHeight: 400 });
  expect(renderer.root.findByType('Image').props.width).toBe(300);
  act(() => renderer.update(<ImageLayer src={1} onLoad={load} onError={error} />));
  expect(load).toHaveBeenLastCalledWith({ naturalWidth: 80, naturalHeight: 60 });
  act(() => renderer.update(<ImageLayer src={{ uri: 'secure.png', headers: { Authorization: 'example' } }} onLoad={load} onError={error} />));
  expect(Image.getSizeWithHeaders).toHaveBeenCalled();
  act(() => renderer.update(<ImageLayer src="failed.png" onLoad={load} onError={error} />));
  act(() => requests.at(-1).failure(new Error('unavailable')));
  expect(error).toHaveBeenCalledTimes(1);
  act(() => renderer.unmount());
  act(() => requests[1].success(3, 4));
  expect(load).toHaveBeenCalledTimes(2);
});

test('geometric hit testing accounts for rotation', () => {
  expect(containsPoint({ x: 0, y: 0, width: 100, height: 20, rotation: 90 }, { x: 50, y: 50 })).toBe(true);
  expect(containsPoint({ x: 0, y: 0, width: 100, height: 20, rotation: 90 }, { x: 0, y: 0 })).toBe(false);
});

test('extra fingers do not move the shape and lifting the initial finger commits once', () => {
  const change = jest.fn();
  const renderer = make(<ShapeEditor><Shape {...rect} onChange={change} /></ShapeEditor>);
  const shape = byId(renderer, 'shape-a');
  const point = (x, y, identifier) => ({ pageX: 90 + x, pageY: 120 + y, identifier });
  send(shape, 'onResponderGrant', touch(15, 25));
  send(shape, 'onResponderMove', touch(300, 300, 1, {
    touches: [point(300, 300, 2), point(35, 45, 1)],
  }));
  expect(byId(renderer, 'shape-a').props.transform).toContain('translate(30,40)');
  send(shape, 'onResponderEnd', touch(300, 300, 1, {
    touches: [point(300, 300, 2)], changedTouches: [point(35, 45, 1)],
  }));
  send(shape, 'onResponderRelease', touch(300, 300));
  expect(change).toHaveBeenCalledTimes(1);
  expect(change.mock.calls[0][0]).toMatchObject({ x: 30, y: 40 });
});

test('unmounting during measurement invalidates a queued gesture', () => {
  let measured;
  const change = jest.fn();
  const focus = jest.fn();
  __measure.mockImplementationOnce(callback => { measured = callback; });
  const renderer = make(<ShapeEditor><Shape {...rect} onChange={change} onFocus={focus} /></ShapeEditor>);
  const shape = byId(renderer, 'shape-a');
  send(shape, 'onResponderGrant', touch(15, 25));
  act(() => renderer.update(<ShapeEditor />));
  act(() => measured(0, 0, 600, 800, 90, 120));
  expect(change).not.toHaveBeenCalled();
  expect(focus).not.toHaveBeenCalled();
});

test('public cancellation invalidates measurement and does not commit a pending drag', () => {
  let measured;
  const editor = createRef();
  const change = jest.fn();
  __measure.mockImplementationOnce(callback => { measured = callback; });
  const renderer = make(<ShapeEditor ref={editor}><Shape {...rect} onChange={change} /></ShapeEditor>);
  send(byId(renderer, 'shape-a'), 'onResponderGrant', touch(15, 25));
  send(byId(renderer, 'shape-a'), 'onResponderRelease', touch(50, 50));
  act(() => editor.current.cancelGesture());
  act(() => measured(0, 0, 600, 800, 90, 120));
  expect(change).not.toHaveBeenCalled();
});

test('custom handles and previews receive native responder props and shape metadata', () => {
  const handle = jest.fn(({ gestureHandlers }) => <Rect testID="custom-handle" {...gestureHandlers} />);
  const preview = jest.fn(({ width, height }) => <Rect testID="custom-preview" width={width} height={height} />);
  const Preview = wrapShape(preview);
  const change = jest.fn();
  const renderer = make(<ShapeEditor scale={2}>
    <DrawLayer DrawPreviewComponent={Preview} onAddShape={() => {}} />
    <Shape {...rect} custom="value" ResizeHandleComponent={handle} onChange={change} />
  </ShapeEditor>);
  const received = handle.mock.calls[0][0];
  expect(received.recommendedSize).toBe(10);
  expect(received.gestureHandlers.onResponderTerminate).toEqual(expect.any(Function));
  drag(byId(renderer, 'custom-handle'), [10, 60], [0, 80], 2);
  expect(change).toHaveBeenCalled();
  send(byId(renderer, 'draw-layer'), 'onResponderGrant', touch(0, 0, 2));
  send(byId(renderer, 'draw-layer'), 'onResponderMove', touch(20, 30, 2));
  expect(byId(renderer, 'custom-preview').props.width).toBe(20);
  expect(preview.mock.calls.at(-1)[0]).toMatchObject({ disabled: true, isBeingChanged: false, shapeId: 'rse-internal-draw-component' });
});

test('a background tap clears logical focus and active keyboard targeting', () => {
  const editor = createRef();
  const change = jest.fn();
  const blur = jest.fn();
  const renderer = make(<ShapeEditor ref={editor}>
    <SelectionLayer selectedShapeIds={[]} onSelectionChange={() => {}}>
      <Shape {...rect} onChange={change} onBlur={blur} />
    </SelectionLayer>
  </ShapeEditor>);
  act(() => editor.current.focusShapeById('a'));
  send(byId(renderer, 'selection-layer'), 'onResponderGrant', touch(200, 200));
  send(byId(renderer, 'selection-layer'), 'onResponderRelease', touch(200, 200));
  act(() => editor.current.handleKeyDown({ key: 'ArrowRight' }));
  expect(blur).toHaveBeenCalledTimes(1);
  expect(change).not.toHaveBeenCalled();
});

test('rotationSpeed unwraps the angle at the PI boundary', () => {
  const change = jest.fn();
  const renderer = make(<ShapeEditor><Shape {...rect} rotationSpeed={2} onChange={change} /></ShapeEditor>);
  const around = degrees => {
    const a = degrees * Math.PI / 180;
    return [60 + 100 * Math.cos(a), 60 + 100 * Math.sin(a)];
  };
  drag(byId(renderer, 'rotate-handle'), around(179), around(-179));
  expect(change.mock.calls[0][0].rotation).toBeCloseTo(4);
});

test('focus policies can be turned off', () => {
  const focus = jest.fn();
  const render = ids => <ShapeEditor focusOnAdd={false} focusOnDelete={false}>{ids.map(id => <Shape key={id} {...rect} shapeId={id} onFocus={focus} />)}</ShapeEditor>;
  const renderer = make(render(['a']));
  act(() => renderer.update(render(['a', 'b'])));
  act(() => renderer.update(render(['a'])));
  expect(focus).not.toHaveBeenCalled();
});

test('a controlled group commit updates all shapes and retains renderable group handles', () => {
  const changed = jest.fn();
  function Controlled() {
    const [items, setItems] = React.useState([{ ...rect }, { ...rect, shapeId: 'b', x: 210 }]);
    const [ids, setIds] = React.useState(['a', 'b']);
    return <ShapeEditor><SelectionLayer selectedShapeIds={ids} onSelectionChange={setIds}
      onChange={(rects, props) => {
        changed(rects);
        const byId = new Map(props.map((props, i) => [props.shapeId, rects[i]]));
        setItems(items => items.map(item => ({ ...item, ...byId.get(item.shapeId) })));
      }}>{items.map(item => <Shape key={item.shapeId} {...item} />)}</SelectionLayer></ShapeEditor>;
  }
  const renderer = make(<Controlled />);
  drag(byId(renderer, 'shape-rse-internal-selection-component'), [150, 60], [200, 90]);
  expect(changed).toHaveBeenCalledTimes(1);
  expect(byId(renderer, 'shape-a').props.transform).toContain('translate(60,50)');
  expect(byId(renderer, 'shape-b').props.transform).toContain('translate(260,50)');
  const group = byId(renderer, 'shape-rse-internal-selection-component');
  const handle = group.findAll(node => node.type === 'Rect' && node.props.testID === 'resize-se')[0];
  drag(handle, [360, 130], [390, 150]);
  expect(changed).toHaveBeenCalledTimes(2);
  expect(changed.mock.calls[1][0][0].width).toBeCloseTo(110);
  expect(changed.mock.calls[1][0][0].height).toBeCloseTo(100);
});

test('React StrictMode lifecycle replay does not disable native gestures or image loading', () => {
  const change = jest.fn();
  const load = jest.fn();
  Image.getSize.mockImplementation((uri, success) => success(120, 90));
  const renderer = make(<React.StrictMode><ShapeEditor>
    <ImageLayer src="strict.png" onLoad={load} />
    <SelectionLayer selectedShapeIds={[]} onSelectionChange={() => {}}>
      <Shape {...rect} onChange={change} />
    </SelectionLayer>
  </ShapeEditor></React.StrictMode>);
  drag(byId(renderer, 'shape-a'), [15, 25], [45, 55]);
  expect(change).toHaveBeenCalledTimes(1);
  expect(change.mock.calls[0][0]).toMatchObject({ x: 40, y: 50 });
  expect(load).toHaveBeenCalledWith({ naturalWidth: 120, naturalHeight: 90 });
});

test('editing responders block native scrolling, including custom handle gestures', () => {
  const renderer = make(<ShapeEditor vectorWidth={400} vectorHeight={650}>
    <DrawLayer onAddShape={() => {}} /><Shape {...rect} />
  </ShapeEditor>);
  for (const id of ['shape-a', 'resize-se', 'rotate-handle', 'draw-layer']) {
    const target = byId(renderer, id);
    let blocksNative;
    act(() => { blocksNative = target.props.onResponderGrant(touch(60, 60)); });
    expect(blocksNative).toBe(true);
    expect(target.props.onResponderTerminationRequest()).toBe(false);
    send(target, 'onResponderTerminate', touch(60, 60));
  }
});

test.each([0.75, 1, 1.25])('successive drags follow finger displacement on both axes at scale %s', scale => {
  let current = { ...rect, rotation: 25 };
  const updates = [];
  const element = () => <ShapeEditor scale={scale} vectorWidth={400} vectorHeight={650}>
    <Shape {...current} onChange={next => { current = { ...current, ...next }; updates.push(next); }} />
  </ShapeEditor>;
  const renderer = make(element());
  // Physical displacement is constant; the stored vector displacement varies
  // with zoom, but rendering must always move by the same amount as the finger.
  for (const [dx, dy] of [[0, 45], [30, 0], [-15, -25]]) {
    const before = { ...current };
    const grab = [current.x + 20, current.y + 30];
    drag(byId(renderer, 'shape-a'), grab, [grab[0] + dx / scale, grab[1] + dy / scale], scale);
    const next = updates.at(-1);
    expect((next.x - before.x) * scale).toBeCloseTo(dx);
    expect((next.y - before.y) * scale).toBeCloseTo(dy);
    act(() => renderer.update(element()));
  }
});
