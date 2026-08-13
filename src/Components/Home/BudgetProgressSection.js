import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BaseCard from '../Common/BaseCard';
import { useTheme } from '../../theme/ThemeContext';

function BudgetProgressItem({ icon, name, remaining, progress, color, styles }) {
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
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View>
      <Text style={styles.sectionTitle}>Budget Progress</Text>
      <BaseCard>
        {categories.map((category, index) => (
          <View
            key={category.name}
            style={index !== categories.length - 1 && styles.itemWrapper}
          >
            <BudgetProgressItem {...category} styles={styles} />
          </View>
        ))}
      </BaseCard>
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    sectionTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '800',
      marginBottom: 14,
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
