import React from 'react';
import { create, act } from 'react-test-renderer';
import NotesEditor from '../../example/NotesEditor';
import { ShapeEditor } from '../index';

// Exercise the actual sample used on a phone: vertical scrolling must never
// compete with SVG editing, but must remain available in its own mode.
test('the notes demo separates scrolling from every editing mode', () => {
  let renderer;
  act(() => { renderer = create(<NotesEditor />); });
  try {
    const scroll = () => renderer.root.findByType('NativeScrollView');
    const editor = () => renderer.root.findByType(ShapeEditor);
    const press = label => {
      const button = renderer.root.findAllByType('NativePressable').find(node =>
        node.findByType('NativeText').props.children.replace(' ✓', '') === label);
      act(() => button.props.onPress());
    };
    expect(scroll().props.scrollEnabled).toBe(false);
    expect(scroll().props.bounces).toBe(false);
    expect(editor().props.pointerEvents).toBe('auto');
    press('Scroll');
    expect(scroll().props.scrollEnabled).toBe(true);
    expect(editor().props.pointerEvents).toBe('none');
    for (const mode of ['Draw', 'Multi-select', 'Select']) {
      press(mode);
      expect(scroll().props.scrollEnabled).toBe(false);
      expect(editor().props.pointerEvents).toBe('auto');
    }
  } finally {
    act(() => renderer.unmount());
  }
});
