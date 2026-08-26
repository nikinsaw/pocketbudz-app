import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import BaseCard from '../Common/BaseCard';
import { useTheme } from '../../theme/ThemeContext';

function SafeToSpendCard({ amount, total, daysLeft, status, onPress }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const isSet = total != null;

  return (
    <BaseCard
      backgroundColor="transparent"
      borderRadius={24}
      padding={24}
      clickable
      onPress={onPress}
    >
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {isSet ? (
        <>
          <Text style={styles.label}>TOTAL SAFE TO SPEND</Text>

          <View style={styles.amountRow}>
            <Text style={styles.amount}>₹{amount}</Text>
            <Text style={styles.total}> / ₹{total}</Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.daysLeft}>{daysLeft} Days Left</Text>
            <Text style={[styles.status, status !== 'On Track' && styles.statusWarning]}>
              {status}
            </Text>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.label}>TOTAL SAFE TO SPEND</Text>
          <Text style={styles.promptText}>
            Set your monthly income to see what's safe to spend this cycle.
          </Text>
          <Text style={styles.promptCta}>Tap to set your income →</Text>
        </>
      )}
    </BaseCard>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    label: {
      color: colors.onGradientMuted,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 1.5,
    },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginTop: 8,
    },
    amount: {
      color: colors.white,
      fontSize: 40,
      fontWeight: '800',
    },
    total: {
      color: colors.onGradientMuted,
      fontSize: 18,
      fontWeight: '600',
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 28,
    },
    daysLeft: {
      color: colors.onGradientMuted,
      fontSize: 14,
    },
    status: {
      color: colors.onTrack,
      fontSize: 14,
      fontWeight: '700',
    },
    statusWarning: {
      color: colors.dining,
    },
    promptText: {
      color: colors.white,
      fontSize: 17,
      fontWeight: '600',
      marginTop: 12,
      lineHeight: 24,
    },
    promptCta: {
      color: colors.white,
      fontSize: 14,
      fontWeight: '700',
      marginTop: 18,
    },
  });

export default SafeToSpendCard;
