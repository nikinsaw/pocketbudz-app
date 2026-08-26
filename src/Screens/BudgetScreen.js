import React from 'react';
import { View, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { HomeHeader } from '../Components/Home';
import { SafeToSpendCard, EnvelopesSection } from '../Components/Budget';
import { useTheme } from '../theme/ThemeContext';

const WARNING_THRESHOLD = 0.85;

// Matches a transaction to an envelope by category label — works for any
// category since both a transaction's category and an envelope's title
// ultimately come from the same profile.categories list.
function computeEnvelopeDisplay(envelope, transactions) {
  const spent = transactions
    .filter((transaction) => transaction.category === envelope.title)
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const progress = envelope.budgetLimit > 0 ? Math.min(spent / envelope.budgetLimit, 1) : 0;

  if (envelope.type === 'fixed') {
    return {
      ...envelope,
      subtitle: progress >= 1 ? 'Paid this cycle' : 'Fixed',
      amount: envelope.budgetLimit.toLocaleString('en-IN'),
      amountLabel: 'set aside',
      locked: true,
      progress,
    };
  }

  const remaining = Math.max(envelope.budgetLimit - spent, 0);
  const warning = progress >= WARNING_THRESHOLD;
  return {
    ...envelope,
    subtitle: warning ? 'Nearing limit' : 'On track',
    amount: remaining.toLocaleString('en-IN'),
    amountLabel: 'left',
    warning,
  };
}

function BudgetScreen() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const navigation = useNavigation();

  const safeToSpend = useSelector((state) => state.budget.safeToSpend);
  const envelopes = useSelector((state) => state.budget.envelopes);
  const transactions = useSelector((state) => state.transactions.items);

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
      >
        <SafeToSpendCard
          amount={safeToSpend.amount}
          total={safeToSpend.total}
          daysLeft={safeToSpend.daysLeft}
          status={safeToSpend.status}
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
