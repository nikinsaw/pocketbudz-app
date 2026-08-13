import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BaseCard from '../Common/BaseCard';
import { useTheme } from '../../theme/ThemeContext';

function PositivePatternCard({ icon, title, description, styles }) {
  return (
    <BaseCard style={styles.card}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </BaseCard>
  );
}

function PositivePatternsSection({ patterns }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View>
      <Text style={styles.sectionTitle}>Positive Patterns</Text>
      {patterns.map((pattern, index) => (
        <View key={pattern.title} style={index !== patterns.length - 1 && styles.spacing}>
          <PositivePatternCard {...pattern} styles={styles} />
        </View>
      ))}
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    sectionTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '800',
      marginBottom: 14,
    },
    spacing: {
      marginBottom: 14,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.pillBg,
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
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 4,
    },
    description: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
  });

export default PositivePatternsSection;
