import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import BaseButton from '../Common/BaseButton';
import { useTheme } from '../../theme/ThemeContext';
import { AGREEMENT_HIGHLIGHTS } from '../../data/householdAgreement';

// Step 1 for someone in solo mode: what Household Mode is, then Google sign-in.
// Signing in only creates the account (Google name + email). Nothing from the
// phone is uploaded until they accept the agreement in the next step.
function HouseholdIntro({ onSignIn, busy, error }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View>
      <Text style={styles.title}>Budget together</Text>
      <Text style={styles.lead}>
        Household Mode lets your family share envelopes and see the same budget, while your
        personal spending stays yours.
      </Text>

      <View style={styles.highlights}>
        {AGREEMENT_HIGHLIGHTS.map((item) => (
          <View key={item.text} style={styles.highlightRow}>
            <Text style={styles.highlightIcon}>{item.icon}</Text>
            <Text style={styles.highlightText}>{item.text}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.note}>
        Signing in creates your PocketBudz account from your Google name and email. Nothing from
        this phone is uploaded until you review and accept the agreement in the next step.
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <BaseButton onPress={onSignIn} disabled={busy} style={styles.primaryButton}>
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.primaryLabel}>Continue with Google</Text>
        )}
      </BaseButton>
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    title: { color: colors.text, fontSize: 26, fontWeight: '800', marginBottom: 8 },
    lead: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 24 },
    highlights: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 20 },
    highlightRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
    highlightIcon: { fontSize: 22, width: 36 },
    highlightText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 },
    note: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 20 },
    errorText: { color: colors.dining, fontSize: 13, marginBottom: 12, lineHeight: 18 },
    primaryButton: {
      backgroundColor: colors.gradientStart,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
    },
    primaryLabel: { color: colors.white, fontSize: 16, fontWeight: '700' },
  });

export default HouseholdIntro;
