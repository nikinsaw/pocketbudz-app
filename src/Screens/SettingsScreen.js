import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { HomeHeader } from '../Components/Home';
import { ProfileCard, SettingsSection } from '../Components/Settings';
import colors from '../theme/colors';

function SettingsScreen() {
  const [darkMode, setDarkMode] = useState(true);
  const [budgetAlerts, setBudgetAlerts] = useState(true);
  const [streakReminders, setStreakReminders] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(false);

  const preferenceRows = [
    { icon: '🌙', label: 'Dark Mode', type: 'toggle', toggled: darkMode, onToggle: setDarkMode },
    { icon: '₹', label: 'Currency Format', type: 'nav', value: 'Indian (Lakhs)' },
    { icon: '📅', label: 'Budget Cycle Start', type: 'nav', value: '1st of month' },
  ];

  const notificationRows = [
    {
      icon: '🔔',
      label: 'Budget Alerts',
      type: 'toggle',
      toggled: budgetAlerts,
      onToggle: setBudgetAlerts,
    },
    {
      icon: '🔥',
      label: 'Streak Reminders',
      type: 'toggle',
      toggled: streakReminders,
      onToggle: setStreakReminders,
    },
    {
      icon: '📊',
      label: 'Weekly Summary',
      type: 'toggle',
      toggled: weeklySummary,
      onToggle: setWeeklySummary,
    },
  ];

  const aboutRows = [
    { icon: '❓', label: 'Help Center', type: 'nav' },
    { icon: '💬', label: 'Contact & Feedback', type: 'nav' },
    { icon: '⭐', label: 'Rate PocketBudz', type: 'nav' },
    { icon: '📄', label: 'Terms & Privacy Policy', type: 'nav' },
    { icon: 'ℹ️', label: 'App Version', type: 'static', value: '1.0.0' },
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
        <ProfileCard name="Aditi Sharma" email="aditi.sharma@email.com" onPress={() => {}} />

        <View style={styles.spacerLarge} />
        <SettingsSection title="Preferences" rows={preferenceRows} />
        <SettingsSection title="Notifications" rows={notificationRows} />
        <SettingsSection title="About" rows={aboutRows} />
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
  spacerLarge: {
    height: 28,
  },
});

export default SettingsScreen;
