import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import BaseCard from '../Common/BaseCard';
import { useTheme } from '../../theme/ThemeContext';

function BudgetProgressItem({ icon, title, amount, amountLabel, progress, color, styles }) {
  return (
    <View style={styles.item}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemLabel}>
          {icon} {title}
        </Text>
        <Text style={styles.itemAmount}>
          ₹{amount} {amountLabel}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function BudgetProgressSection({ envelopes, onSeeAll, onCreateEnvelope }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const isEmpty = envelopes.length === 0;

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Budget Progress</Text>
        {!isEmpty ? (
          <Pressable onPress={onSeeAll}>
            <Text style={styles.seeAll}>See All</Text>
          </Pressable>
        ) : null}
      </View>

      {isEmpty ? (
        <BaseCard clickable onPress={onCreateEnvelope} style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🎯</Text>
          <Text style={styles.emptyTitle}>No budgets yet</Text>
          <Text style={styles.emptyMessage}>
            Create an envelope to start tracking what you spend.
          </Text>
          <Text style={styles.emptyCta}>＋ Create Envelope</Text>
        </BaseCard>
      ) : (
        <BaseCard>
          {envelopes.map((envelope, index) => (
            <View key={envelope.id} style={index !== envelopes.length - 1 && styles.itemWrapper}>
              <BudgetProgressItem {...envelope} styles={styles} />
            </View>
          ))}
        </BaseCard>
      )}
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '800',
    },
    seeAll: {
      color: colors.teal,
      fontSize: 15,
      fontWeight: '600',
    },
    itemWrapper: {
      marginBottom: 22,
    },
    item: {},
    itemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    itemLabel: {
      color: colors.text,
      fontSize: 16,
    },
    itemAmount: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.trackDark,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: 3,
    },
    emptyCard: {
      alignItems: 'center',
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.teal,
    },
    emptyIcon: {
      fontSize: 28,
      marginBottom: 8,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 4,
    },
    emptyMessage: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: 'center',
      marginBottom: 14,
    },
    emptyCta: {
      color: colors.teal,
      fontSize: 15,
      fontWeight: '700',
    },
  });

export default BudgetProgressSection;
