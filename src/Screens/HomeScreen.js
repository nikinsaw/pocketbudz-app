import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { ScrollView } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import {
  HomeHeader,
  SavedThisMonthCard,
  GuiltFreeCard,
  BudgetProgressSection,
  RecentActivitySection,
} from '../Components/Home';
import { useTheme } from '../theme/ThemeContext';
import { getActivityDisplay } from '../utils/transactionDisplay';
import { computeBudgetSummary } from '../utils/budgetSummary';

const RECENT_ACTIVITY_LIMIT = 5;

function HomeScreen() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const navigation = useNavigation();

  const categories = useSelector((state) => state.budget.categories);
  const envelopes = useSelector((state) => state.budget.envelopes);
  const transactions = useSelector((state) => state.transactions.items);
  const monthlyIncome = useSelector((state) => state.profile.monthlyIncome);
  const budgetCycleStartDay = useSelector((state) => state.profile.budgetCycleStartDay);

  const { savedThisMonth, guiltFreeToSpend } = computeBudgetSummary({
    envelopes,
    transactions,
    monthlyIncome,
    budgetCycleStartDay,
  });

  const budgetCategories = categories.map((category) => ({
    ...category,
    color: colors[category.colorKey],
  }));

  // Insertion order isn't guaranteed to match date order once backdated
  // ("yesterday") or bulk-imported transactions mix in, so sort explicitly
  // rather than trust unshift() alone.
  const sortedTransactions = [...transactions].sort((a, b) => b.date.localeCompare(a.date));

  const recentActivities = sortedTransactions
    .slice(0, RECENT_ACTIVITY_LIMIT)
    .map((transaction) => getActivityDisplay(transaction, colors));

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
          amount={savedThisMonth?.amount}
          progress={savedThisMonth?.progress}
          onPress={() => navigation.navigate('EditIncome')}
        />

        <View style={styles.spacer} />
        <GuiltFreeCard
          amount={guiltFreeToSpend?.amount}
          onPress={() => navigation.navigate('EditIncome')}
        />

        <View style={styles.spacerLarge} />
        <BudgetProgressSection categories={budgetCategories} />

        <View style={styles.spacerLarge} />
        <RecentActivitySection
          activities={recentActivities}
          onSeeAll={() => navigation.navigate('AllTransactions')}
        />
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
