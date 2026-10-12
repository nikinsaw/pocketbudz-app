import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import BaseCard from '../../Common/BaseCard';
import { useTheme } from '../../../theme/ThemeContext';

// The big number at the top: what the household has spent this cycle, plus the
// shared/personal(/income) breakdown and, for earners, what is left.
function DashboardHeadline({ view }) {
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
      <Text style={styles.label}>{view.periodLabel.toUpperCase()}</Text>
      <Text style={styles.amount}>{view.headline.amountLabel}</Text>
      <Text style={styles.caption}>{view.headline.caption}</Text>
      {view.headline.note ? <Text style={styles.note}>{view.headline.note}</Text> : null}

      <View style={styles.stats}>
        {view.stats.map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {view.leftOver ? (
        <View style={styles.leftOverPill}>
          <Text style={styles.leftOverText}>
            {view.leftOver.label}: {view.leftOver.value}
          </Text>
        </View>
      ) : null}

      <Text style={styles.progress}>{view.progressLabel}</Text>
    </BaseCard>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    label: { color: colors.onGradientMuted, fontSize: 13, fontWeight: '700', letterSpacing: 1.5 },
    amount: { color: colors.white, fontSize: 40, fontWeight: '800', marginTop: 8 },
    caption: { color: colors.onGradientMuted, fontSize: 14, marginTop: 2 },
    note: { color: colors.onGradientMuted, fontSize: 12, lineHeight: 17, marginTop: 8 },
    stats: { flexDirection: 'row', marginTop: 22 },
    stat: { flex: 1 },
    statValue: { color: colors.white, fontSize: 16, fontWeight: '800' },
    statLabel: { color: colors.onGradientMuted, fontSize: 12, marginTop: 2 },
    leftOverPill: {
      alignSelf: 'flex-start',
      backgroundColor: colors.streakPill,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginTop: 18,
    },
    leftOverText: { color: colors.white, fontSize: 13, fontWeight: '700' },
    progress: { color: colors.onGradientMuted, fontSize: 12, marginTop: 18 },
  });

export default DashboardHeadline;
