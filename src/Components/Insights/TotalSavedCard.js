import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BaseCard from '../Common/BaseCard';
import colors from '../../theme/colors';

function TotalSavedCard({ label, amount, changeLabel, months }) {
  return (
    <BaseCard>
      <View style={styles.header}>
        <View>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.amount}>₹{amount}</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{changeLabel}</Text>
        </View>
      </View>

      <View style={styles.chartPlaceholder}>
        <Text style={styles.chartPlaceholderText}>Chart coming soon</Text>
      </View>

      <View style={styles.axis}>
        {months.map((month) => (
          <Text key={month} style={styles.axisLabel}>
            {month}
          </Text>
        ))}
      </View>
    </BaseCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  label: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 8,
  },
  amount: {
    color: colors.white,
    fontSize: 30,
    fontWeight: '800',
  },
  pill: {
    backgroundColor: colors.pillBg,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  pillText: {
    color: colors.teal,
    fontSize: 13,
    fontWeight: '700',
  },
  chartPlaceholder: {
    height: 160,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  chartPlaceholderText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  axisLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
});

export default TotalSavedCard;
