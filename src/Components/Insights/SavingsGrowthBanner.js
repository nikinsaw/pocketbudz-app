import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BaseCard from '../Common/BaseCard';
import { useTheme } from '../../theme/ThemeContext';

function SavingsGrowthBanner({ title, message }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <BaseCard backgroundColor={colors.successTint} style={styles.card}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>📈</Text>
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </BaseCard>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.successIconBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    icon: {
      fontSize: 20,
    },
    textWrap: {
      flex: 1,
    },
    title: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '700',
      marginBottom: 4,
    },
    message: {
      color: colors.textDim,
      fontSize: 14,
      lineHeight: 20,
    },
  });

export default SavingsGrowthBanner;
