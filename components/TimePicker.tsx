import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  value: string; // "HH:MM" or ""
  onChange: (value: string) => void;
}

function parseToDate(hhmm: string): Date {
  const parts = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(isNaN(parts[0]) ? 8 : parts[0], isNaN(parts[1]) ? 0 : parts[1], 0, 0);
  return d;
}

function dateToHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function TimePicker({ value, onChange }: Props) {
  const [show, setShow] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(() => parseToDate(value || '08:00'));

  const open = () => {
    setTempDate(parseToDate(value || '08:00'));
    setShow(true);
  };

  if (Platform.OS === 'ios') {
    return (
      <View style={s.container}>
        <Pressable style={s.button} onPress={open}>
          <Text style={[s.buttonText, !value && s.placeholder]}>{value || '--:--'}</Text>
        </Pressable>
        <Modal visible={show} transparent animationType="slide">
          <View style={s.backdrop}>
            <View style={s.sheet}>
              <View style={s.toolbar}>
                <Pressable onPress={() => setShow(false)}>
                  <Text style={s.cancel}>Cancel</Text>
                </Pressable>
                <Pressable onPress={() => { onChange(dateToHHMM(tempDate)); setShow(false); }}>
                  <Text style={s.done}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                mode="time"
                value={tempDate}
                is24Hour={true}
                display="spinner"
                onChange={(_: DateTimePickerEvent, d?: Date) => { if (d) setTempDate(d); }}
              />
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Pressable style={s.button} onPress={open}>
        <Text style={[s.buttonText, !value && s.placeholder]}>{value || '--:--'}</Text>
      </Pressable>
      {show && (
        <DateTimePicker
          mode="time"
          value={tempDate}
          is24Hour={true}
          onChange={(event: DateTimePickerEvent, selected?: Date) => {
            setShow(false);
            if (event.type !== 'dismissed' && selected) onChange(dateToHHMM(selected));
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { marginBottom: 16 },
  button: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  buttonText: { fontSize: 15, color: '#111827' },
  placeholder: { color: '#9ca3af' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  cancel: { fontSize: 16, color: '#6b7280' },
  done: { fontSize: 16, color: '#2563eb', fontWeight: '600' },
});
