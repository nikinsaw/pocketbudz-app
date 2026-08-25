import React from 'react';
import { View, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { useSelector } from 'react-redux';
import { HomeHeader } from '../Components/Home';
import { SafeToSpendCard, EnvelopesSection } from '../Components/Budget';
import { useTheme } from '../theme/ThemeContext';

function BudgetScreen() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);

  const safeToSpend = useSelector((state) => state.budget.safeToSpend);
  const envelopes = useSelector((state) => state.budget.envelopes);

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
          envelopes={envelopes}
          onEdit={() => {}}
          onCreate={() => {}}
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
