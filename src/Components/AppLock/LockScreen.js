import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BaseButton from '../Common/BaseButton';
import { useTheme } from '../../theme/ThemeContext';

function LockScreen({ status, onUnlock }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View style={styles.screen}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>🔒</Text>
      </View>
      <Text style={styles.title}>PocketBudz is locked</Text>
      <Text style={styles.subtitle}>Verify your identity to continue</Text>

      {status === 'error' ? (
        <Text style={styles.error}>Couldn't verify — try again.</Text>
      ) : null}

      <BaseButton onPress={onUnlock} disabled={status === 'checking'} style={styles.button}>
        <Text style={styles.buttonLabel}>
          {status === 'checking' ? 'Verifying…' : 'Unlock'}
        </Text>
      </BaseButton>
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.pillBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    icon: {
      fontSize: 32,
    },
    title: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '800',
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 8,
    },
    error: {
      color: colors.dining,
      fontSize: 13,
      textAlign: 'center',
      marginTop: 8,
    },
    button: {
      marginTop: 28,
      backgroundColor: colors.gradientStart,
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 32,
    },
    buttonLabel: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '700',
    },
  });

export default LockScreen;
