import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import BaseCard from '../Common/BaseCard';
import { useTheme } from '../../theme/ThemeContext';

function SavedThisMonthCard({ amount, progress, onPress }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const isSet = amount != null;

  return (
    <BaseCard
      backgroundColor="transparent"
      borderRadius={24}
      padding={24}
      clickable
      onPress={onPress}
    >
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.label}>SAVED THIS MONTH</Text>
      {isSet ? (
        <>
          <Text style={styles.amount}>₹{amount}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        </>
      ) : (
        <Text style={styles.promptText}>Set your monthly income to start tracking savings.</Text>
      )}
    </BaseCard>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    label: {
      color: colors.onGradientMuted,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 1.5,
    },
    amount: {
      color: colors.white,
      fontSize: 44,
      fontWeight: '800',
      marginTop: 8,
    },
    promptText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '600',
      marginTop: 12,
      lineHeight: 22,
    },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.trackLight,
      marginTop: 28,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: colors.white,
    },
  });

export default SavedThisMonthCard;
