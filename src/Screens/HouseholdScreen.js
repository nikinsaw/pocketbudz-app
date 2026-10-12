import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useDispatch, useSelector } from 'react-redux';
import CustomHeader from '../Components/Common/CustomHeader';
import HouseholdIntro from '../Components/Household/HouseholdIntro';
import HouseholdSetup from '../Components/Household/HouseholdSetup';
import HouseholdStatus from '../Components/Household/HouseholdStatus';
import { useTheme } from '../theme/ThemeContext';
import { householdActions } from '../services/householdApp';
import { selectHouseholdMode } from '../store/slices/householdSlice';
import { describeHouseholdError, isCancelled } from '../utils/householdErrors';

// One route for all of Household Mode. Which step shows follows the account state:
//   solo       -> intro + Google sign-in
//   signed-in  -> create or join a household
//   household  -> members, invites, leave
function HouseholdScreen() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const dispatch = useDispatch();
  const mode = useSelector(selectHouseholdMode);
  const user = useSelector((state) => state.household.user);
  const household = useSelector((state) => state.household.current);
  const hasAccount = user !== null;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); // sign-in problems, shown by the intro
  const [syncError, setSyncError] = useState(''); // refresh problems, shown as a banner

  // Opening the screen refreshes which household (if any) the account is in, so
  // changes made elsewhere (removed, invited) show up. Offline keeps cached state.
  useEffect(() => {
    if (hasAccount) {
      setSyncError('');
      dispatch(householdActions.restore()).catch((e) => setSyncError(describeHouseholdError(e)));
    }
  }, [dispatch, hasAccount]);

  // Runs one user-triggered action with a busy flag and a friendly error. Cancelling
  // the Google chooser is not an error.
  const run = async (thunk) => {
    setBusy(true);
    setError('');
    try {
      await dispatch(thunk);
    } catch (e) {
      if (!isCancelled(e)) {
        setError(describeHouseholdError(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSignIn = () => run(householdActions.signIn());

  // Stable identity: HouseholdStatus loads members in an effect keyed on this.
  const fetchMembers = useCallback(() => dispatch(householdActions.fetchMembers()), [dispatch]);
  const createInvite = useCallback((input) => dispatch(householdActions.createInvite(input)), [dispatch]);

  const confirmLeave = () =>
    Alert.alert(
      'Leave household?',
      'You’ll stop sharing a budget with this household. Your past spending stays as anonymous totals so everyone else’s numbers stay correct, but its details can no longer be read. Your personal envelopes, income entries and sharing choices are deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => run(householdActions.leaveHousehold()) },
      ],
    );

  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <CustomHeader title="Household mode" />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        extraScrollHeight={20}
      >
        {mode !== 'solo' && syncError ? <Text style={styles.syncError}>{syncError}</Text> : null}
        {mode === 'solo' ? (
          <HouseholdIntro onSignIn={handleSignIn} busy={busy} error={error} />
        ) : null}
        {mode === 'signed-in' ? (
          <HouseholdSetup
            user={user}
            fetchConsentVersion={householdActions.fetchConsentVersion}
            onCreate={(input) => run(householdActions.createHousehold(input))}
            onJoin={(input) => run(householdActions.joinHousehold(input))}
            onSignOut={() => run(householdActions.signOut())}
            busy={busy}
            error={error}
          />
        ) : null}
        {mode === 'household' ? (
          <HouseholdStatus
            household={household}
            fetchMembers={fetchMembers}
            createInvite={createInvite}
            onLeave={confirmLeave}
            onSignOut={() => run(householdActions.signOut())}
            busy={busy}
            error={error}
          />
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
    syncError: {
      color: colors.dining,
      backgroundColor: colors.warningTint,
      borderRadius: 12,
      padding: 12,
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 16,
    },
  });

export default HouseholdScreen;
