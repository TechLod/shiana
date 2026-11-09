import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatEventTime } from '../lib/format';
import { colors } from '../lib/theme';

interface Props {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
}

/** Date and time picker that works on both iOS and Android. */
export function DateTimeField({ label, value, onChange, minimumDate }: Props): React.ReactElement {
  if (Platform.OS === 'ios') {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.iosRow}>
          <DateTimePicker
            value={value}
            mode="datetime"
            display="compact"
            
            minimumDate={minimumDate}
            onChange={(_event: any, picked?: Date) => {
              if (picked) onChange(picked);
            }}
          />
        </View>
      </View>
    );
  }

  const open = () => {
    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      minimumDate,
      onChange: (_event: any, pickedDate?: Date) => {
        if (!pickedDate) return;
        DateTimePickerAndroid.open({
          value: pickedDate,
          mode: 'time',
          onChange: (_event2: any, pickedTime?: Date) => {
            if (!pickedTime) return;
            const result = new Date(pickedDate);
            result.setHours(pickedTime.getHours(), pickedTime.getMinutes(), 0, 0);
            onChange(result);
          },
        });
      },
    });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={open} style={styles.androidButton} accessibilityRole="button">
        <Text style={styles.androidText}>{formatEventTime(value.toISOString())}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 13, color: colors.sub, marginBottom: 6 },
  iosRow: { flexDirection: 'row', alignItems: 'center' },
  androidButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  androidText: { fontSize: 16, color: colors.text },
});
