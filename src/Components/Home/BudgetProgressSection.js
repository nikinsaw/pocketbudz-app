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

function BudgetProgressSection({ envelopes, onSeeAll }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Budget Progress</Text>
        <Pressable onPress={onSeeAll}>
          <Text style={styles.seeAll}>See All</Text>
        </Pressable>
      </View>
      <BaseCard>
        {envelopes.map((envelope, index) => (
          <View key={envelope.id} style={index !== envelopes.length - 1 && styles.itemWrapper}>
            <BudgetProgressItem {...envelope} styles={styles} />
          </View>
        ))}
      </BaseCard>
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
  });

export default BudgetProgressSection;
