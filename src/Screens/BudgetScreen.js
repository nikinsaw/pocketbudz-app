import React from 'react';
import { View, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { HomeHeader } from '../Components/Home';
import { SafeToSpendCard, EnvelopesSection } from '../Components/Budget';
import { useTheme } from '../theme/ThemeContext';

const envelopes = [
  {
    icon: '🛍️',
    title: 'Shopping',
    subtitle: 'Guilt-free zone',
    amount: '8,500',
    amountLabel: 'left',
  },
  {
    icon: '🍴',
    title: 'Dining Out',
    subtitle: 'Treat yourself',
    amount: '4,200',
    amountLabel: 'left',
  },
  {
    icon: '🚗',
    title: 'Transport',
    subtitle: 'Nearing limit',
    amount: '500',
    amountLabel: 'left',
    warning: true,
  },
  {
    icon: '🏠',
    title: 'Rent',
    subtitle: 'Fixed',
    amount: '32,000',
    amountLabel: 'set aside',
    locked: true,
    progress: 0.8,
  },
];

function BudgetScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.headerBackground} />
      <HomeHeader />
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SafeToSpendCard amount="45,200" total="60,000" daysLeft={12} status="On Track" />

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
