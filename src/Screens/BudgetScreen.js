import React from 'react';
import { View, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { HomeHeader } from '../Components/Home';
import SyncBanner from '../Components/Household/SyncBanner';
import { useHouseholdRefresh } from '../Components/Household/useHouseholdRefresh';
import {
  selectBudgetCycleStartDay,
  selectEnvelopes,
  selectMonthlyIncome,
  selectTransactions,
} from '../store/selectors';
import { SafeToSpendCard, EnvelopesSection } from '../Components/Budget';
import { useTheme } from '../theme/ThemeContext';
import { computeBudgetSummary } from '../utils/budgetSummary';
import { computeEnvelopeDisplay } from '../utils/envelopeDisplay';

function BudgetScreen() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const navigation = useNavigation();

  const envelopes = useSelector(selectEnvelopes);
  const transactions = useSelector(selectTransactions);
  const monthlyIncome = useSelector(selectMonthlyIncome);
  const budgetCycleStartDay = useSelector(selectBudgetCycleStartDay);
  const refreshControl = useHouseholdRefresh();

  const { safeToSpend } = computeBudgetSummary({
    envelopes,
    transactions,
    monthlyIncome,
    budgetCycleStartDay,
  });

  const displayEnvelopes = envelopes.map((envelope) =>
    computeEnvelopeDisplay(envelope, transactions),
  );

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
        refreshControl={refreshControl}
      >
        <SyncBanner />
        <SafeToSpendCard
          amount={safeToSpend?.amount}
          total={safeToSpend?.total}
          daysLeft={safeToSpend?.daysLeft}
          status={safeToSpend?.status}
          onPress={() => navigation.navigate('EditIncome')}
        />

        <View style={styles.spacerLarge} />
        <EnvelopesSection
          envelopes={displayEnvelopes}
          onEditEnvelope={(envelope) =>
            navigation.navigate('CreateEnvelope', { envelopeId: envelope.id })
          }
          onCreate={() => navigation.navigate('CreateEnvelope')}
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
    spacerLarge: {
      height: 28,
    },
  });

export default BudgetScreen;
