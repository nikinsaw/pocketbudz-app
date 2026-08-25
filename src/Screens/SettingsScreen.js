import React from 'react';
import { View, StyleSheet, ScrollView, StatusBar, Alert } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { HomeHeader } from '../Components/Home';
import { ProfileCard, SettingsSection } from '../Components/Settings';
import { useTheme } from '../theme/ThemeContext';
import {
  toggleBudgetAlerts,
  toggleStreakReminders,
  toggleWeeklySummary,
  setAppLockEnabled,
} from '../store/slices/settingsSlice';
import { isBiometricAvailable, enableAppLock, disableAppLock } from '../storage/appLock';

function SettingsScreen() {
  const { colors, isDark, setIsDark } = useTheme();
  const styles = getStyles(colors);
  const dispatch = useDispatch();

  const { budgetAlerts, streakReminders, weeklySummary, appLockEnabled } = useSelector(
    (state) => state.settings,
  );

  const handleToggleAppLock = async (next) => {
    if (next) {
      const available = await isBiometricAvailable();
      if (!available) {
        Alert.alert(
          'Biometric lock unavailable',
          'Set up Face ID, Touch ID, or fingerprint unlock in your device settings first.',
        );
        return;
      }
      await enableAppLock();
    } else {
      await disableAppLock();
    }
    dispatch(setAppLockEnabled(next));
  };

  const preferenceRows = [
    { icon: '🌙', label: 'Dark Mode', type: 'toggle', toggled: isDark, onToggle: setIsDark },
    { icon: '₹', label: 'Currency Format', type: 'nav', value: 'Indian (Lakhs)' },
    { icon: '📅', label: 'Budget Cycle Start', type: 'nav', value: '1st of month' },
  ];

  const securityRows = [
    {
      icon: '🔐',
      label: 'App Lock',
      type: 'toggle',
      toggled: appLockEnabled,
      onToggle: handleToggleAppLock,
    },
  ];

  const notificationRows = [
    {
      icon: '🔔',
      label: 'Budget Alerts',
      type: 'toggle',
      toggled: budgetAlerts,
      onToggle: () => dispatch(toggleBudgetAlerts()),
    },
    {
      icon: '🔥',
      label: 'Streak Reminders',
      type: 'toggle',
      toggled: streakReminders,
      onToggle: () => dispatch(toggleStreakReminders()),
    },
    {
      icon: '📊',
      label: 'Weekly Summary',
      type: 'toggle',
      toggled: weeklySummary,
      onToggle: () => dispatch(toggleWeeklySummary()),
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
        <ProfileCard name="Aditi Sharma" email="aditi.sharma@email.com" onPress={() => {}} />

        <View style={styles.spacerLarge} />
        <SettingsSection title="Preferences" rows={preferenceRows} />
        <SettingsSection title="Security & Privacy" rows={securityRows} />
        <SettingsSection title="Notifications" rows={notificationRows} />
        <SettingsSection title="About" rows={aboutRows} />
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

export default SettingsScreen;
