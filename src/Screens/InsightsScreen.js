import React from 'react';
import { View, Text, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { HomeHeader } from '../Components/Home';
import {
  SavingsGrowthBanner,
  TotalSavedCard,
  CategorySpendCard,
  PositivePatternsSection,
} from '../Components/Insights';
import BaseCard from '../Components/Common/BaseCard';
import { useTheme } from '../theme/ThemeContext';
import { computeInsights } from '../utils/insightsSummary';

function InsightsScreen() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const navigation = useNavigation();

  const envelopes = useSelector((state) => state.budget.envelopes);
  const transactions = useSelector((state) => state.transactions.items);
  const monthlyIncome = useSelector((state) => state.profile.monthlyIncome);
  const budgetCycleStartDay = useSelector((state) => state.profile.budgetCycleStartDay);

  const { categorySpend, savingsGrowth, totalSaved, positivePatterns } = computeInsights({
    envelopes,
    transactions,
    monthlyIncome,
    budgetCycleStartDay,
  });

  const spendCategories = categorySpend
    ? categorySpend.categories.map((category) => ({
        ...category,
        color: colors[category.colorKey],
      }))
    : [];

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
        <Text style={styles.title}>Savings Growth</Text>

        {monthlyIncome ? (
          <>
            <SavingsGrowthBanner title={savingsGrowth.title} message={savingsGrowth.message} />

            <View style={styles.spacerLarge} />
            <TotalSavedCard
              label={totalSaved.label}
              amount={totalSaved.amount}
              changeLabel={totalSaved.changeLabel}
              series={totalSaved.series}
            />
          </>
        ) : (
          <BaseCard clickable onPress={() => navigation.navigate('EditIncome')} style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>💰</Text>
            <Text style={styles.emptyTitle}>Set your monthly income</Text>
            <Text style={styles.emptyMessage}>
              We'll track how much you're saving each cycle once your income is set.
            </Text>
            <Text style={styles.emptyCta}>＋ Set Income</Text>
          </BaseCard>
        )}

        <View style={styles.spacerLarge} />
        <Text style={[styles.title, categorySpend?.period && styles.titleTight]}>
          Category Spend
        </Text>
        {categorySpend ? (
          <>
            {categorySpend.period ? (
              <Text style={styles.subtitle}>{categorySpend.period}</Text>
            ) : null}
            <CategorySpendCard total={categorySpend.total} categories={spendCategories} />
          </>
        ) : (
          <BaseCard
            clickable
            onPress={() => navigation.navigate('ManageTransaction')}
            style={styles.emptyCard}
          >
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>No spending yet this cycle</Text>
            <Text style={styles.emptyMessage}>
              Add a transaction to see where your money is going.
            </Text>
            <Text style={styles.emptyCta}>＋ Add Transaction</Text>
          </BaseCard>
        )}

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
    emptyCard: {
      alignItems: 'center',
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.teal,
    },
    emptyIcon: {
      fontSize: 28,
      marginBottom: 8,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 4,
    },
    emptyMessage: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: 'center',
      marginBottom: 14,
    },
    emptyCta: {
      color: colors.teal,
      fontSize: 15,
      fontWeight: '700',
    },
  });

export default InsightsScreen;
