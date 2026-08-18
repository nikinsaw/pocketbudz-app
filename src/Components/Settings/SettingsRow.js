import React from 'react';
import { View, Text, Switch, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

function SettingsRow({ icon, label, type = 'nav', value, toggled, onPress, onToggle, isLast }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const content = (
    <>
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
    </>
  );

  // Toggle rows let the Switch itself own tap handling (native settings-list
  // convention) — wrapping it in a Pressable with its own onPress risks
  // double-firing when the tap lands on the switch's own hit area.
  if (type === 'nav') {
    return (
      <Pressable onPress={onPress} style={[styles.row, !isLast && styles.rowDivider]}>
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.row, !isLast && styles.rowDivider]}>{content}</View>;
}

const getStyles = (colors) =>
  StyleSheet.create({
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
      color: colors.text,
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
