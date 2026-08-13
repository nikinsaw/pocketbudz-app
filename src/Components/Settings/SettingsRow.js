import React from 'react';
import { View, Text, Switch, StyleSheet, Pressable } from 'react-native';
import colors from '../../theme/colors';

function SettingsRow({ icon, label, type = 'nav', value, toggled, onPress, onToggle, isLast }) {
  const handlePress = type === 'toggle' ? () => onToggle && onToggle(!toggled) : onPress;

  return (
    <Pressable
      onPress={type === 'static' ? undefined : handlePress}
      style={[styles.row, !isLast && styles.rowDivider]}
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.label}>{label}</Text>

      {type === 'toggle' ? (
        <Switch
          value={toggled}
          onValueChange={onToggle}
          trackColor={{ false: colors.trackDark, true: colors.gradientStart }}
          thumbColor={colors.white}
        />
      ) : type === 'nav' ? (
        <View style={styles.navValue}>
          {value ? <Text style={styles.value}>{value}</Text> : null}
          <Text style={styles.chevron}>›</Text>
        </View>
      ) : (
        <Text style={styles.value}>{value}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  icon: {
    fontSize: 18,
    marginRight: 14,
    width: 22,
    textAlign: 'center',
  },
  label: {
    flex: 1,
    color: colors.white,
    fontSize: 15,
  },
  navValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    color: colors.textMuted,
    fontSize: 14,
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 20,
    fontWeight: '300',
    marginLeft: 6,
  },
});

export default SettingsRow;
