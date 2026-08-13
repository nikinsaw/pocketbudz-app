import React from 'react';
import { View, Text, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { HomeHeader } from '../Components/Home';
import {
  SavingsGrowthBanner,
  TotalSavedCard,
  CategorySpendCard,
  PositivePatternsSection,
} from '../Components/Insights';
import { useTheme } from '../theme/ThemeContext';

const savedMonths = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const positivePatterns = [
  {
    icon: '☕',
    title: 'Lower coffee spend',
    description: 'You spent 20% less on cafes this week compared to your average.',
  },
  {
    icon: '🏆',
    title: 'Great weekend saving',
    description: 'Stayed within budget for entertainment for the 3rd weekend in a row.',
  },
];

function InsightsScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const categorySpend = [
    { name: 'Housing', amount: '8,000', color: colors.housing },
    { name: 'Groceries', amount: '5,000', color: colors.groceries },
    { name: 'Dining Out', amount: '4,200', color: colors.dining, warning: true },
    { name: 'Transport', amount: '1,000', color: colors.travel },
  ];

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

        <SavingsGrowthBanner
          title="Great job!"
          message="You saved ₹2,100 more than last month!"
        />

        <View style={styles.spacerLarge} />
        <TotalSavedCard
          label="Total Saved (6 mo)"
          amount="42,500"
          changeLabel="+12.4%"
          months={savedMonths}
        />

        <View style={styles.spacerLarge} />
        <Text style={styles.title}>Category Spend</Text>
        <CategorySpendCard total="18,200" categories={categorySpend} />

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
    spacerLarge: {
      height: 28,
    },
  });

export default InsightsScreen;
