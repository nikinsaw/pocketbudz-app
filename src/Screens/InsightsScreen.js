import React from 'react';
import { View, Text, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { useSelector } from 'react-redux';
import { HomeHeader } from '../Components/Home';
import {
  SavingsGrowthBanner,
  TotalSavedCard,
  CategorySpendCard,
  PositivePatternsSection,
} from '../Components/Insights';
import { useTheme } from '../theme/ThemeContext';

function InsightsScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const savingsGrowth = useSelector((state) => state.insights.savingsGrowth);
  const totalSaved = useSelector((state) => state.insights.totalSaved);
  const categorySpend = useSelector((state) => state.insights.categorySpend);
  const positivePatterns = useSelector((state) => state.insights.positivePatterns);

  const spendCategories = categorySpend.categories.map((category) => ({
    ...category,
    color: colors[category.colorKey],
  }));

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.headerBackground} />
      <HomeHeader />
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Savings Growth</Text>

        <SavingsGrowthBanner title={savingsGrowth.title} message={savingsGrowth.message} />

        <View style={styles.spacerLarge} />
        <TotalSavedCard
          label={totalSaved.label}
          amount={totalSaved.amount}
          changeLabel={totalSaved.changeLabel}
          series={totalSaved.series}
        />

        <View style={styles.spacerLarge} />
        <Text style={[styles.title, categorySpend.period && styles.titleTight]}>
          Category Spend
        </Text>
        {categorySpend.period ? (
          <Text style={styles.subtitle}>{categorySpend.period}</Text>
        ) : null}
        <CategorySpendCard total={categorySpend.total} categories={spendCategories} />

        <View style={styles.spacerLarge} />
        <PositivePatternsSection patterns={positivePatterns} />
      </ScrollView>
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    body: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 40,
    },
    title: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '800',
      marginBottom: 16,
    },
    titleTight: {
      marginBottom: 4,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 14,
      marginBottom: 16,
    },
    spacerLarge: {
      height: 28,
    },
  });

export default InsightsScreen;
