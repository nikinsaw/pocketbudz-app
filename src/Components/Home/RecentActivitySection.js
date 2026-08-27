import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import BaseCard from '../Common/BaseCard';
import { useTheme } from '../../theme/ThemeContext';
import ActivityItem from './ActivityItem';

function RecentActivitySection({ activities, onSeeAll, onEditActivity, onAddTransaction }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const isEmpty = activities.length === 0;

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {!isEmpty ? (
          <Pressable onPress={onSeeAll}>
            <Text style={styles.seeAll}>See All</Text>
          </Pressable>
        ) : null}
      </View>

      {isEmpty ? (
        <BaseCard clickable onPress={onAddTransaction} style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🧾</Text>
          <Text style={styles.emptyTitle}>No transactions yet</Text>
          <Text style={styles.emptyMessage}>
            Add your first one to start tracking your spending.
          </Text>
          <Text style={styles.emptyCta}>＋ Add Transaction</Text>
        </BaseCard>
      ) : (
        activities.map((activity, index) => (
          <ActivityItem
            key={activity.id ?? index}
            {...activity}
            onPress={onEditActivity ? () => onEditActivity(activity.id) : undefined}
          />
        ))
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

export default RecentActivitySection;
