import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../../theme/colors';

function BudgetProgressItem({ icon, name, remaining, progress, color }) {
  return (
    <View style={styles.item}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemLabel}>
          {icon} {name}
        </Text>
        <Text style={styles.itemAmount}>₹{remaining} left</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function BudgetProgressSection({ categories }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Budget Progress</Text>
      <View style={styles.card}>
        {categories.map((category, index) => (
          <View
            key={category.name}
            style={[styles.itemWrapper, index === categories.length - 1 && styles.itemWrapperLast]}
          >
            <BudgetProgressItem {...category} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 14,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  itemWrapper: {
    marginBottom: 22,
  },
  itemWrapperLast: {
    marginBottom: 20,
  },
  item: {},
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  itemLabel: {
    color: colors.white,
    fontSize: 16,
  },
  itemAmount: {
    color: colors.white,
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
