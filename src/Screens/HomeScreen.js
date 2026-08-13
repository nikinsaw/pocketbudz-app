import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { ScrollView } from 'react-native';
import {
  HomeHeader,
  SavedThisMonthCard,
  GuiltFreeCard,
  BudgetProgressSection,
  RecentActivitySection,
} from '../Components/Home';
import colors from '../theme/colors';

const budgetCategories = [
  { name: 'Dining', icon: '🍴', remaining: '2,400', progress: 0.6, color: colors.dining },
  { name: 'Groceries', icon: '🛒', remaining: '4,100', progress: 0.3, color: colors.groceries },
  { name: 'Travel', icon: '🚗', remaining: '900', progress: 0.85, color: colors.travel },
];

const recentActivities = [
  {
    name: 'Blue Tokai',
    subtitle: 'Today, 9:41 AM',
    amount: '350',
    icon: '☕',
    iconBackground: 'rgba(76,215,246,0.15)',
  },
  {
    name: 'Blinkit',
    subtitle: 'Yesterday, 6:20 PM',
    amount: '820',
    icon: '🛍️',
    iconBackground: 'rgba(31,187,166,0.18)',
  },
  {
    name: 'Netflix',
    subtitle: '12 Oct',
    amount: '649',
    icon: '📺',
    iconBackground: 'rgba(255,107,129,0.18)',
  },
];

function HomeScreen() {
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.headerBackground} />
      <HomeHeader />
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SavedThisMonthCard amount="12,400" streakDays={12} progress={0.68} />

        <View style={styles.spacer} />
        <GuiltFreeCard amount="8,600" />

        <View style={styles.spacerLarge} />
        <BudgetProgressSection categories={budgetCategories} />

        <View style={styles.spacerLarge} />
        <RecentActivitySection activities={recentActivities} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
