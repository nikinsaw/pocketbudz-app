import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import CustomHeader from '../Components/Common/CustomHeader';
import HouseholdIntro from '../Components/Household/HouseholdIntro';
import HouseholdSetup from '../Components/Household/HouseholdSetup';
import HouseholdStatus from '../Components/Household/HouseholdStatus';
import ImportDataCard from '../Components/Household/ImportDataCard';
import { useTheme } from '../theme/ThemeContext';
import { householdActions } from '../services/householdApp';
import { selectHouseholdMode } from '../store/slices/householdSlice';
import { describeHouseholdError, isCancelled } from '../utils/householdErrors';
import { buildSoloData } from '../utils/soloData';

// One route for all of Household Mode. Which step shows follows the account state:
//   solo       -> intro + Google sign-in
//   signed-in  -> create or join a household
//   household  -> members, invites, leave
function HouseholdScreen() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const mode = useSelector(selectHouseholdMode);
  const user = useSelector((state) => state.household.user);
  const household = useSelector((state) => state.household.current);
  const hasAccount = user !== null;

  // What is on this phone, for the one-time upload offer.
  const phoneEnvelopes = useSelector((state) => state.budget.envelopes);
  const phoneTransactions = useSelector((state) => state.transactions.items);
  const monthlyIncome = useSelector((state) => state.profile.monthlyIncome);
  const importedFor = useSelector((state) => state.household.importedFor);
  const phone = useMemo(
    () =>
      buildSoloData(
        { envelopes: phoneEnvelopes, transactions: phoneTransactions, monthlyIncome },
        'PERSONAL',
      ),
    [phoneEnvelopes, phoneTransactions, monthlyIncome],
  );
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState(null);

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

  const handleImport = async ({ scope }) => {
    setImportBusy(true);
    setImportError('');
    try {
      setImportResult(await dispatch(householdActions.importSoloData({ scope })));
    } catch (e) {
      setImportError(describeHouseholdError(e));
    } finally {
      setImportBusy(false);
    }
  };

  const alreadyImported = household && importedFor === household.membershipId;
  const importSection =
    household && (!alreadyImported || importResult) ? (
      <ImportDataCard
        counts={phone.counts}
        hasIncome={phone.payload.monthlyIncome !== null}
        role={household.role}
        onImport={handleImport}
        busy={importBusy}
        error={importError}
        result={importResult}
      />
    ) : null;

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
            onOpenDashboard={() => navigation.navigate('HouseholdDashboard')}
            busy={busy}
            error={error}
            importSection={importSection}
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
