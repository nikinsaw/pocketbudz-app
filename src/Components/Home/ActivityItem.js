import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

// Shared row renderer for both HomeScreen's "Recent Activity" preview and
// the full AllTransactionsScreen list. Tappable (opens edit) when onPress
// is given — same pattern as EnvelopeCard. In selection mode (AllTransactionsScreen's
// bulk-delete flow) the row shows a checkbox and toggles selection instead
// of navigating to edit.
function ActivityItem({
  icon,
  iconBackground,
  name,
  subtitle,
  amount,
  onPress,
  selectable = false,
  selected = false,
  onToggleSelect,
}) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const handlePress = selectable ? onToggleSelect : onPress;
  const Wrapper = handlePress ? Pressable : View;

  return (
    <Wrapper style={styles.item} onPress={handlePress}>
      {selectable ? (
        <Text style={styles.checkbox}>{selected ? '☑' : '☐'}</Text>
      ) : null}
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
    checkbox: {
      fontSize: 20,
      color: colors.teal,
      marginRight: 12,
      width: 22,
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
