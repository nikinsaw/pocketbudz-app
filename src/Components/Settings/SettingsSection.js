import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BaseCard from '../Common/BaseCard';
import SettingsRow from './SettingsRow';
import colors from '../../theme/colors';

function SettingsSection({ title, rows }) {
  return (
    <View>
      <Text style={styles.title}>{title}</Text>
      <BaseCard style={styles.card} padding={0}>
        <View style={styles.inner}>
          {rows.map((row, index) => (
            <SettingsRow key={row.label} {...row} isLast={index === rows.length - 1} />
          ))}
        </View>
      </BaseCard>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  card: {
    marginBottom: 28,
  },
  inner: {
    paddingHorizontal: 16,
  },
});

export default SettingsSection;
