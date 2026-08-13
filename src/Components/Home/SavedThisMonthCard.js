import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import BaseCard from '../Common/BaseCard';
import { useTheme } from '../../theme/ThemeContext';

function SavedThisMonthCard({ amount, streakDays, progress = 0.68 }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <BaseCard backgroundColor="transparent" borderRadius={24} padding={24}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.label}>SAVED THIS MONTH</Text>
      <Text style={styles.amount}>₹{amount}</Text>

      <View style={styles.streakPill}>
        <Text style={styles.streakText}>🔥 {streakDays}-day streak</Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
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
    streakPill: {
      alignSelf: 'flex-start',
      backgroundColor: colors.streakPill,
      borderRadius: 20,
      paddingVertical: 8,
      paddingHorizontal: 16,
      marginTop: 20,
    },
    streakText: {
      color: colors.white,
      fontWeight: '600',
      fontSize: 14,
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
