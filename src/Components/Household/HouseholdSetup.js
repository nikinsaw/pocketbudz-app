import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import BaseButton from '../Common/BaseButton';
import AgreementView from './AgreementView';
import { useTheme } from '../../theme/ThemeContext';
import { AGREEMENT_VERSION } from '../../data/householdAgreement';

// Step 2: create a household or join one with an invite code. The agreement is
// accepted here - the moment data would actually be uploaded - and the server records
// which version was accepted. Before offering it, we ask the server which version it
// expects: if this app's text is older, accepting it would be refused anyway.
function HouseholdSetup({ user, fetchConsentVersion, onCreate, onJoin, onSignOut, busy, error }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [versionStatus, setVersionStatus] = useState('checking'); // checking | ok | outdated | offline
  const [mode, setMode] = useState('create'); // create | join
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);

  const checkVersion = useCallback(async () => {
    setVersionStatus('checking');
    try {
      const serverVersion = await fetchConsentVersion();
      setVersionStatus(serverVersion === AGREEMENT_VERSION ? 'ok' : 'outdated');
    } catch {
      setVersionStatus('offline');
    }
  }, [fetchConsentVersion]);

  useEffect(() => {
    checkVersion();
  }, [checkVersion]);

  const trimmedName = name.trim();
  const trimmedCode = code.trim();
  const hasInput = mode === 'create' ? trimmedName.length > 0 : trimmedCode.length > 0;
  const canSubmit = versionStatus === 'ok' && accepted && hasInput && !busy;

  const submit = () => {
    if (!canSubmit) {
      return;
    }
    if (mode === 'create') {
      onCreate({ name: trimmedName, consentVersion: AGREEMENT_VERSION });
    } else {
      onJoin({ code: trimmedCode, consentVersion: AGREEMENT_VERSION });
    }
  };

  if (versionStatus === 'checking') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.gradientStart} />
      </View>
    );
  }

  if (versionStatus === 'outdated') {
    return (
      <View>
        <Text style={styles.title}>Update PocketBudz</Text>
        <Text style={styles.lead}>
          The household agreement has changed since this version of the app. Update PocketBudz
          from the Play Store to continue.
        </Text>
        <BaseButton onPress={onSignOut} style={styles.linkButton}>
          <Text style={styles.linkLabel}>Sign out</Text>
        </BaseButton>
      </View>
    );
  }

  if (versionStatus === 'offline') {
    return (
      <View>
        <Text style={styles.title}>Can{'’'}t reach the server</Text>
        <Text style={styles.lead}>Check your internet connection, then try again.</Text>
        <BaseButton onPress={checkVersion} style={styles.primaryButton}>
          <Text style={styles.primaryLabel}>Try again</Text>
        </BaseButton>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.title}>Set up your household</Text>
      <Text style={styles.lead}>
        Signed in as {user.name} ({user.email}).
      </Text>

      <View style={styles.tabs}>
        {[
          ['create', 'Create new'],
          ['join', 'Join with code'],
        ].map(([key, label]) => (
          <BaseButton
            key={key}
            onPress={() => setMode(key)}
            style={[styles.tab, mode === key && styles.tabActive]}
            accessibilityState={{ selected: mode === key }}
          >
            <Text style={[styles.tabLabel, mode === key && styles.tabLabelActive]}>{label}</Text>
          </BaseButton>
        ))}
      </View>

      {mode === 'create' ? (
        <View>
          <Text style={styles.fieldLabel}>Household name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Sharma family"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            maxLength={60}
          />
          <Text style={styles.hint}>You{'’'}ll be the owner and can invite others afterwards.</Text>
        </View>
      ) : (
        <View>
          <Text style={styles.fieldLabel}>Invite code</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="Paste the code you were sent"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.hint}>Ask the household owner to send you an invite.</Text>
        </View>
      )}

      <BaseButton
        onPress={() => setAccepted((value) => !value)}
        style={styles.checkRow}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
      >
        <Text style={styles.checkbox}>{accepted ? '☑' : '☐'}</Text>
        <Text style={styles.checkText}>
          I{'’'}ve read and agree to the Household Mode agreement.
        </Text>
      </BaseButton>

      <BaseButton onPress={() => setShowAgreement((value) => !value)} style={styles.linkButton}>
        <Text style={styles.linkLabel}>
          {showAgreement ? 'Hide the agreement' : 'Read the agreement'}
        </Text>
      </BaseButton>
      {showAgreement ? <AgreementView /> : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <BaseButton onPress={submit} disabled={!canSubmit} style={[styles.primaryButton, !canSubmit && styles.disabled]}>
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.primaryLabel}>{mode === 'create' ? 'Create household' : 'Join household'}</Text>
        )}
      </BaseButton>

      <BaseButton onPress={onSignOut} style={styles.linkButton}>
        <Text style={styles.linkLabel}>Not you? Sign out</Text>
      </BaseButton>
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    centered: { paddingVertical: 60, alignItems: 'center' },
    title: { color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: 8 },
    lead: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginBottom: 20 },
    tabs: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, padding: 4, marginBottom: 20 },
    tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
    tabActive: { backgroundColor: colors.gradientStart },
    tabLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
    tabLabelActive: { color: colors.white },
    fieldLabel: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 8 },
    input: {
      backgroundColor: colors.card,
      color: colors.text,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
    },
    hint: { color: colors.textMuted, fontSize: 12, marginTop: 8, marginBottom: 20 },
    checkRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
    checkbox: { color: colors.gradientStart, fontSize: 24, marginRight: 10, lineHeight: 26 },
    checkText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 },
    linkButton: { paddingVertical: 12, alignItems: 'center' },
    linkLabel: { color: colors.teal, fontSize: 14, fontWeight: '700' },
    errorText: { color: colors.dining, fontSize: 13, lineHeight: 18, marginVertical: 12 },
    primaryButton: {
      backgroundColor: colors.gradientStart,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 12,
    },
    disabled: { opacity: 0.45 },
    primaryLabel: { color: colors.white, fontSize: 16, fontWeight: '700' },
  });

export default HouseholdSetup;
