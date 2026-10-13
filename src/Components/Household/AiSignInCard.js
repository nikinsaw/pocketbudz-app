import React, { useState } from 'react';
import { Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import BaseCard from '../Common/BaseCard';
import BaseButton from '../Common/BaseButton';
import { useTheme } from '../../theme/ThemeContext';
import { householdActions } from '../../services/householdApp';
import { describeHouseholdError, isCancelled } from '../../utils/householdErrors';

// AI features run through the PocketBudz server (which holds the Gemini key), so they need a
// signed-in account. Shown on the AI screens until the person has signed in. It does NOT
// start Household Mode: signing in only creates the account.
function AiSignInCard() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const dispatch = useDispatch();
  const signedIn = useSelector((state) => state.household.user !== null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (signedIn) {
    return null;
  }

  const handleSignIn = async () => {
    setBusy(true);
    setError('');
    try {
      await dispatch(householdActions.signIn());
    } catch (e) {
      if (!isCancelled(e)) {
        setError(describeHouseholdError(e));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <BaseCard style={styles.card}>
      <Text style={styles.title}>Sign in to use AI</Text>
      <Text style={styles.body}>
        AI features now run through your PocketBudz account. What you type or scan is sent through
        our server to Google{'’'}s Gemini to get an answer, and we don{'’'}t store it. Everything
        else in the app stays on your phone, and you don{'’'}t have to join a household.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <BaseButton onPress={handleSignIn} disabled={busy} style={[styles.button, busy && styles.disabled]}>
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.buttonLabel}>Continue with Google</Text>
        )}
      </BaseButton>
    </BaseCard>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    card: { marginBottom: 20 },
    title: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 6 },
    body: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 12 },
    error: { color: colors.dining, fontSize: 13, lineHeight: 18, marginBottom: 10 },
    button: {
      backgroundColor: colors.gradientStart,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: 'center',
    },
    disabled: { opacity: 0.6 },
    buttonLabel: { color: colors.white, fontSize: 15, fontWeight: '700' },
  });

export default AiSignInCard;
