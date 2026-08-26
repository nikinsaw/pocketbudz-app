import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

// Shared row renderer for both HomeScreen's "Recent Activity" preview and
// the full AllTransactionsScreen list. Tappable (opens edit) when onPress
// is given — same pattern as EnvelopeCard.
function ActivityItem({ icon, iconBackground, name, subtitle, amount, onPress }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper style={styles.item} onPress={onPress}>
      <View style={[styles.iconWrap, { backgroundColor: iconBackground }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.details}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.amount}>-₹{amount}</Text>
    </Wrapper>
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
