import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BaseCard from '../Common/BaseCard';
import { useTheme } from '../../theme/ThemeContext';

function CategorySpendRow({ name, amount, color, warning, isLast, styles }) {
  return (
    <View style={[styles.row, warning && styles.rowWarning, !isLast && styles.rowSpacing]}>
      <View style={styles.rowLeft}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.name}>{name}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.amount, warning && styles.amountWarning]}>₹{amount}</Text>
        {warning ? <Text style={styles.warningIcon}> ⚠️</Text> : null}
      </View>
    </View>
  );
}

function CategorySpendCard({ total, categories }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <BaseCard>
      <View style={styles.totalWrap}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalAmount}>₹{total}</Text>
      </View>

      <View style={styles.list}>
        {categories.map((category, index) => (
          <CategorySpendRow
            key={category.name}
            {...category}
            isLast={index === categories.length - 1}
            styles={styles}
          />
        ))}
      </View>
    </BaseCard>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    totalWrap: {
      alignItems: 'center',
      paddingVertical: 12,
    },
    totalLabel: {
      color: colors.textMuted,
      fontSize: 14,
      marginBottom: 6,
    },
    totalAmount: {
      color: colors.text,
      fontSize: 30,
      fontWeight: '800',
    },
    list: {
      marginTop: 20,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
    },
    rowSpacing: {
      marginBottom: 4,
    },
    rowWarning: {
      backgroundColor: colors.warningTint,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 12,
    },
    name: {
      color: colors.text,
      fontSize: 15,
    },
    rowRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    amount: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    amountWarning: {
      color: colors.dining,
    },
    warningIcon: {
      fontSize: 13,
    },
  });

export default CategorySpendCard;
