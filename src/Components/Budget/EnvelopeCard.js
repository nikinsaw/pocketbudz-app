import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BaseCard from '../Common/BaseCard';
import colors from '../../theme/colors';

function EnvelopeCard({ icon, title, subtitle, amount, amountLabel, warning, locked, progress }) {
  return (
    <BaseCard
      style={[styles.card, warning && styles.cardWarning]}
      backgroundColor={colors.card}
    >
      <View style={styles.header}>
        <View style={[styles.iconWrap, warning && styles.iconWrapWarning]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{title}</Text>
          <Text style={[styles.subtitle, warning && styles.subtitleWarning]}>{subtitle}</Text>
        </View>
        {locked ? <Text style={styles.lock}>🔒</Text> : null}
      </View>

      <View style={styles.amountRow}>
        <Text style={[styles.amount, warning && styles.amountWarning]}>₹{amount}</Text>
        <Text style={styles.amountLabel}>{amountLabel}</Text>
      </View>

      {progress != null ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      ) : null}
    </BaseCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  cardWarning: {
    borderWidth: 1.5,
    borderColor: colors.warningBorder,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.pillBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconWrapWarning: {
    backgroundColor: colors.warningTint,
  },
  icon: {
    fontSize: 20,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  subtitleWarning: {
    color: colors.dining,
    fontWeight: '600',
  },
  lock: {
    fontSize: 15,
    opacity: 0.6,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  amount: {
    color: colors.white,
    fontSize: 26,
    fontWeight: '800',
  },
  amountWarning: {
    color: colors.dining,
  },
  amountLabel: {
    color: colors.textMuted,
    fontSize: 14,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.trackDark,
    marginTop: 14,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.gradientStart,
  },
});

export default EnvelopeCard;
