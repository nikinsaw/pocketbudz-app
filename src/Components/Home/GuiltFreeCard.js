import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BaseCard from '../Common/BaseCard';
import { useTheme } from '../../theme/ThemeContext';

function GuiltFreeCard({ amount, onPress }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const isSet = amount != null;

  return (
    <BaseCard style={styles.card} clickable onPress={onPress}>
      <View style={styles.textWrap}>
        <Text style={styles.label}>Guilt-free to spend</Text>
        {isSet ? (
          <View style={styles.amountRow}>
            <Text style={styles.amount}>₹{amount}</Text>
            <Text style={styles.suffix}> left</Text>
          </View>
        ) : (
          <Text style={styles.promptText}>Set your monthly income to see this</Text>
        )}
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeGlyph}>🙂</Text>
      </View>
    </BaseCard>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    textWrap: {
      flex: 1,
      marginRight: 12,
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
    promptText: {
      color: colors.teal,
      fontSize: 14,
      fontWeight: '600',
    },
    badge: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.pillBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeGlyph: {
      fontSize: 22,
    },
  });

export default GuiltFreeCard;
