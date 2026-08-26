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
import { computeEnvelopeDisplay } from '../utils/envelopeDisplay';

const RECENT_ACTIVITY_LIMIT = 5;
const BUDGET_PROGRESS_LIMIT = 3;

function HomeScreen() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const navigation = useNavigation();

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

  // Top 3 by usage — the most actionable envelopes to surface on a Home
  // preview — regardless of type, then handed off to the Budget tab (via
  // See All) for the full list. Mirrors BudgetScreen's own computation so
  // the numbers always agree.
  const topEnvelopes = [...envelopes]
    .map((envelope) => computeEnvelopeDisplay(envelope, transactions))
    .sort((a, b) => b.progress - a.progress)
    .slice(0, BUDGET_PROGRESS_LIMIT)
    .map((envelope) => ({ ...envelope, color: colors[envelope.colorKey] }));

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
        <BudgetProgressSection
          envelopes={topEnvelopes}
          onSeeAll={() => navigation.navigate('Budget')}
        />

        <View style={styles.spacerLarge} />
        <RecentActivitySection
          activities={recentActivities}
          onSeeAll={() => navigation.navigate('AllTransactions')}
          onEditActivity={(id) => navigation.navigate('ManageTransaction', { transactionId: id })}
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
