import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, StatusBar, Alert, ActivityIndicator } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import BaseButton from '../Components/Common/BaseButton';
import CustomHeader from '../Components/Common/CustomHeader';
import { useTheme } from '../theme/ThemeContext';
import { householdActions } from '../services/householdApp';
import { saveAccountData } from '../services/exportAccountData';
import { describeHouseholdError } from '../utils/householdErrors';

const CONFIRM_WORD = 'DELETE';

// Your PocketBudz account (the Google sign-in used for Household mode): download what is
// stored about you, or delete it. Required by Google Play for any app with accounts.
function AccountScreen() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const user = useSelector((state) => state.household.user);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportDone, setExportDone] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const canDelete = confirmText.trim() === CONFIRM_WORD && !deleting;

  const handleExport = async () => {
    setExporting(true);
    setExportError('');
    setExportDone(false);
    try {
      const data = await dispatch(householdActions.exportAccount());
      const result = await saveAccountData(data);
      if (result.success) {
        setExportDone(true);
      } else if (!result.cancelled) {
        setExportError(result.error);
      }
    } catch (e) {
      setExportError(describeHouseholdError(e));
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await dispatch(householdActions.deleteAccount());
    } catch (e) {
      setDeleteError(describeHouseholdError(e));
      setDeleting(false);
      return;
    }
    Alert.alert(
      'Account deleted',
      'Your PocketBudz account and the data stored with it have been deleted. The budget on this phone is still here.',
    );
    navigation.goBack();
  };

  const confirmDelete = () =>
    Alert.alert(
      'Delete your account?',
      'This can’t be undone. You’ll be signed out everywhere and your account is erased.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete account', style: 'destructive', onPress: handleDelete },
      ],
    );

  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <CustomHeader title="Account" />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        extraScrollHeight={20}
      >
        {user ? (
          <>
            <View style={styles.card}>
              <Text style={styles.name}>{user.name}</Text>
              <Text style={styles.email}>{user.email}</Text>
              <Text style={styles.note}>Signed in with Google</Text>
            </View>

            <Text style={styles.sectionTitle}>Download your data</Text>
            <View style={styles.card}>
              <Text style={styles.body}>
                A file with your account details, the agreements you accepted, and your own
                budget data from each household you’re in: your envelopes, spending, income and
                sharing choices. Other people’s private spending isn’t included.
              </Text>
              <BaseButton
                onPress={handleExport}
                disabled={exporting}
                style={[styles.primaryButton, exporting && styles.disabled]}
              >
                {exporting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryLabel}>Download my data</Text>
                )}
              </BaseButton>
              {exportDone ? <Text style={styles.success}>Saved.</Text> : null}
              {exportError ? <Text style={styles.errorText}>{exportError}</Text> : null}
            </View>

            <Text style={styles.sectionTitle}>Delete your account</Text>
            <View style={styles.card}>
              <Text style={styles.body}>Deleting your account will:</Text>
              <Text style={styles.bullet}>• erase your profile and sign you out everywhere</Text>
              <Text style={styles.bullet}>
                • remove you from any household. Your past spending stays there only as anonymous
                totals, so everyone else’s numbers stay correct, and nobody can read its details
              </Text>
              <Text style={styles.bullet}>
                • delete a household you’re the only member of, with everything in it
              </Text>
              <Text style={styles.body}>
                If you own a household that others are in, hand over ownership first. The budget
                saved on this phone isn’t touched.
              </Text>

              <Text style={styles.fieldLabel}>Type {CONFIRM_WORD} to confirm</Text>
              <TextInput
                value={confirmText}
                onChangeText={setConfirmText}
                placeholder={`Type ${CONFIRM_WORD}`}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <BaseButton
                onPress={confirmDelete}
                disabled={!canDelete}
                style={[styles.dangerButton, !canDelete && styles.disabled]}
              >
                {deleting ? (
                  <ActivityIndicator color={colors.dining} />
                ) : (
                  <Text style={styles.dangerLabel}>Delete my account</Text>
                )}
              </BaseButton>
              {deleteError ? <Text style={styles.errorText}>{deleteError}</Text> : null}
            </View>
          </>
        ) : (
          <Text style={styles.body}>You’re not signed in to a PocketBudz account.</Text>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
    card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 24 },
    name: { color: colors.text, fontSize: 18, fontWeight: '800' },
    email: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
    note: { color: colors.textMuted, fontSize: 12, marginTop: 8 },
    sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 10 },
    body: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 10 },
    bullet: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 6 },
    fieldLabel: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 8, marginBottom: 6 },
    input: {
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
    },
    primaryButton: {
      backgroundColor: colors.gradientStart,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 4,
    },
    primaryLabel: { color: colors.white, fontSize: 15, fontWeight: '700' },
    dangerButton: {
      borderWidth: 1,
      borderColor: colors.dining,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 14,
    },
    dangerLabel: { color: colors.dining, fontSize: 15, fontWeight: '700' },
    disabled: { opacity: 0.45 },
    success: { color: colors.textMuted, fontSize: 13, marginTop: 10 },
    errorText: { color: colors.dining, fontSize: 13, lineHeight: 18, marginTop: 10 },
  });

export default AccountScreen;
