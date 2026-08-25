import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import BaseCard from '../Common/BaseCard';
import { useTheme } from '../../theme/ThemeContext';

function TotalSavedCard({ label, amount, changeLabel, series }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [chartWidth, setChartWidth] = useState(0);

  return (
    <BaseCard>
      <View style={styles.header}>
        <View>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.amount}>₹{amount}</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{changeLabel}</Text>
        </View>
      </View>

      <View
        style={styles.chartWrap}
        onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
      >
        {chartWidth > 0 && series && series.length > 0 ? (
          <LineChart
            data={series}
            width={chartWidth}
            height={140}
            initialSpacing={8}
            endSpacing={8}
            spacing={(chartWidth - 16) / Math.max(series.length - 1, 1)}
            curved
            areaChart
            color={colors.teal}
            thickness={3}
            startFillColor={colors.gradientStart}
            endFillColor={colors.gradientStart}
            startOpacity={0.35}
            endOpacity={0}
            dataPointsColor={colors.teal}
            dataPointsRadius={4}
            hideRules
            hideYAxisText
            yAxisColor="transparent"
            xAxisColor={colors.cardBorder}
            xAxisLabelTextStyle={styles.axisLabel}
            disableScroll
          />
        ) : null}
      </View>
    </BaseCard>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    label: {
      color: colors.textMuted,
      fontSize: 14,
      marginBottom: 8,
    },
    amount: {
      color: colors.text,
      fontSize: 30,
      fontWeight: '800',
    },
    pill: {
      backgroundColor: colors.pillBg,
      borderRadius: 20,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    pillText: {
      color: colors.teal,
      fontSize: 13,
      fontWeight: '700',
    },
    chartWrap: {
      marginTop: 24,
    },
    axisLabel: {
      color: colors.textMuted,
      fontSize: 12,
    },
  });

export default TotalSavedCard;
