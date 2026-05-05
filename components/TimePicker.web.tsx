import { StyleSheet, View } from 'react-native';

interface Props {
  value: string; // "HH:MM" or ""
  onChange: (value: string) => void;
}

export function TimePicker({ value, onChange }: Props) {
  return (
    <View style={s.container}>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border: '1px solid #d1d5db',
          borderRadius: 8,
          padding: 12,
          fontSize: 15,
          color: '#111827',
          backgroundColor: '#fff',
          width: '100%',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
          outline: 'none',
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { marginBottom: 16 },
});
