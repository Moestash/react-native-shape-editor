import React, { useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, Modal, ScrollView } from 'react-native';
import { Rect, Text as SvgText, TSpan } from 'react-native-svg';
import { ShapeEditor, DrawLayer, SelectionLayer, wrapShape } from 'react-native-shape-editor';

const Note = wrapShape(({ width, height, body, active, scale }) => (
  <>
    <Rect width={width} height={height} rx={4} fill="#fff3a8" stroke={active ? '#5139a8' : '#cfb851'} strokeWidth={1 / scale} />
    <SvgText x={8} y={20} fontSize={14} fill="#302a17" pointerEvents="none">
      {body.split('\n').slice(0, Math.max(1, Math.floor((height - 8) / 18))).map((line, index) => (
        <TSpan key={index} x={8} dy={index ? 18 : 0}>{line.slice(0, Math.max(1, Math.floor((width - 16) / 8)))}</TSpan>
      ))}
    </SvgText>
  </>
));

export default function NotesEditor() {
  const [notes, setNotes] = useState([
    { id: '1', x: 30, y: 70, width: 150, height: 100, rotation: 0, body: 'Meeting notes\nTap Edit to write' },
    { id: '2', x: 210, y: 220, width: 130, height: 90, rotation: 0, body: 'To do\nPlan the next step' },
  ]);
  const [selected, setSelected] = useState([]);
  const [mode, setMode] = useState('select');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [viewportWidth, setViewportWidth] = useState(400);
  const nextId = useRef(3);
  const selection = useRef(null);
  const update = (rects, props) => {
    const changes = new Map(props.map((item, index) => [item.shapeId, rects[index]]));
    setNotes(current => current.map(note => changes.has(note.id) ? { ...note, ...changes.get(note.id) } : note));
  };
  const remove = (_, props) => {
    const ids = new Set(props.map(item => item.shapeId));
    setNotes(current => current.filter(note => !ids.has(note.id)));
    setSelected([]);
  };
  const button = (label, action, disabled = false) => (
    <Pressable key={label} onPress={action} disabled={disabled}
      style={{ padding: 10, margin: 3, backgroundColor: disabled ? '#eee' : '#e7e0fa', borderRadius: 6 }}>
      <Text>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ flex: 1, paddingTop: 48 }} onLayout={event => setViewportWidth(event.nativeEvent.layout.width)}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 8 }}>
        {button(mode === 'select' ? 'Select ✓' : 'Select', () => setMode('select'))}
        {button(mode === 'draw' ? 'Draw ✓' : 'Draw', () => setMode('draw'))}
        {button(mode === 'multiple' ? 'Multi-select ✓' : 'Multi-select', () => setMode('multiple'))}
        {button(mode === 'scroll' ? 'Scroll ✓' : 'Scroll', () => setMode('scroll'))}
        {button('Delete', () => selection.current.deleteSelection(), !selected.length)}
        {button('Edit text', () => {
          const note = notes.find(item => item.id === selected[0]);
          setDraft(note.body); setEditing(true);
        }, selected.length !== 1)}
      </View>
      <Text style={{ padding: 12 }}>Drag notes or handles. Double-tap the round handle to reset rotation. Multi-select adds/removes notes; choose Select to move the group. Choose Scroll to move around the canvas.</Text>
      <ScrollView scrollEnabled={mode === 'scroll'} bounces={false} contentContainerStyle={{ alignItems: 'center' }}>
        <ShapeEditor pointerEvents={mode === 'scroll' ? 'none' : 'auto'} vectorWidth={400} vectorHeight={650} scale={Math.min(1, viewportWidth / 400)} style={{ backgroundColor: '#f5f5f8' }}>
          <SelectionLayer ref={selection} selectedShapeIds={selected} onSelectionChange={setSelected}
            selectionMode={mode === 'multiple' ? 'multiple' : 'single'} onChange={update} onDelete={remove}>
            {mode === 'draw' && <DrawLayer onAddShape={rect => {
              const id = String(nextId.current++);
              setNotes(current => [...current, { ...rect, id, body: 'New note' }]);
            }} />}
            {notes.map(note => <Note key={note.id} {...note} shapeId={note.id}
              onChange={(rect, props) => update([rect], [props])} onDelete={(event, props) => remove(event, [props])} />)}
          </SelectionLayer>
        </ShapeEditor>
      </ScrollView>
      <Modal visible={editing} animationType="slide" onRequestClose={() => setEditing(false)}>
        <View style={{ flex: 1, padding: 24, paddingTop: 60 }}>
          <TextInput autoFocus multiline value={draft} onChangeText={setDraft}
            style={{ minHeight: 180, borderWidth: 1, borderColor: '#aaa', padding: 12, textAlignVertical: 'top' }} />
          {button('Save', () => {
            setNotes(current => current.map(note => note.id === selected[0] ? { ...note, body: draft } : note));
            setEditing(false);
          })}
          {button('Cancel', () => setEditing(false))}
        </View>
      </Modal>
    </View>
  );
}
