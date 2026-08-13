import React from 'react';
import { StyleSheet, Text } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import BaseButton from './Common/BaseButton';
import { useTheme } from '../theme/ThemeContext';

function CustomAddButton({ onPress, disabled }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <BaseButton onPress={onPress} disabled={disabled} style={styles.wrapper} hitSlop={12}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={styles.circle}
      >
        <Text style={styles.glyph}>+</Text>
      </LinearGradient>
    </BaseButton>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    wrapper: {
      top: -20,
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
    },
    circle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    glyph: {
      color: colors.white,
      fontSize: 28,
      fontWeight: '600',
      lineHeight: 30,
    },
  });

export default CustomAddButton;
