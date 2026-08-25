import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { ScrollView } from 'react-native';
import { useSelector } from 'react-redux';
import {
  HomeHeader,
  SavedThisMonthCard,
  GuiltFreeCard,
  BudgetProgressSection,
  RecentActivitySection,
} from '../Components/Home';
import { useTheme } from '../theme/ThemeContext';
import { formatRelativeDate } from '../utils/formatDate';

const activityTints = {
  teal: (colors) => colors.pillBg,
  success: (colors) => colors.successTint,
  warning: (colors) => colors.warningTint,
};

function HomeScreen() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);

  const savedThisMonth = useSelector((state) => state.budget.savedThisMonth);
  const guiltFreeToSpend = useSelector((state) => state.budget.guiltFreeToSpend);
  const categories = useSelector((state) => state.budget.categories);
  const transactions = useSelector((state) => state.transactions.items);

  const budgetCategories = categories.map((category) => ({
    ...category,
    color: colors[category.colorKey],
  }));

  const recentActivities = transactions.map((transaction) => ({
    id: transaction.id,
    name: transaction.merchant,
    subtitle: formatRelativeDate(transaction.date),
    amount: transaction.amount.toLocaleString('en-IN'),
    icon: transaction.icon,
    iconBackground: activityTints[transaction.tint](colors),
  }));

  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.card}
      />
      <HomeHeader />
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SavedThisMonthCard
          amount={savedThisMonth.amount}
          streakDays={savedThisMonth.streakDays}
          progress={savedThisMonth.progress}
        />

        <View style={styles.spacer} />
        <GuiltFreeCard amount={guiltFreeToSpend.amount} />

        <View style={styles.spacerLarge} />
        <BudgetProgressSection categories={budgetCategories} />

        <View style={styles.spacerLarge} />
        <RecentActivitySection activities={recentActivities} />
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
    spacer: {
      height: 16,
    },
    spacerLarge: {
      height: 28,
    },
  });

export default HomeScreen;
