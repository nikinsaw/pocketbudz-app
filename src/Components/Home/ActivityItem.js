import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

// Shared row renderer for both HomeScreen's "Recent Activity" preview and
// the full AllTransactionsScreen list.
function ActivityItem({ icon, iconBackground, name, subtitle, amount }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View style={styles.item}>
      <View style={[styles.iconWrap, { backgroundColor: iconBackground }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.details}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.amount}>-₹{amount}</Text>
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 22,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    icon: {
      fontSize: 20,
    },
    details: {
      flex: 1,
    },
    name: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      marginTop: 2,
    },
    amount: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
  });

export default ActivityItem;
