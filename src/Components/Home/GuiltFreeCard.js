import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../../theme/colors';

function GuiltFreeCard({ amount }) {
  return (
    <View style={styles.card}>
      <View>
        <Text style={styles.label}>Guilt-free to spend</Text>
        <View style={styles.amountRow}>
          <Text style={styles.amount}>₹{amount}</Text>
          <Text style={styles.suffix}> left</Text>
        </View>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeGlyph}>🙂</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
  },
  label: {
    color: colors.textMuted,
    fontSize: 15,
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  amount: {
    color: colors.teal,
    fontSize: 26,
    fontWeight: '800',
  },
  suffix: {
    color: colors.textMuted,
    fontSize: 15,
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(76,215,246,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGlyph: {
    fontSize: 22,
  },
});

export default GuiltFreeCard;
