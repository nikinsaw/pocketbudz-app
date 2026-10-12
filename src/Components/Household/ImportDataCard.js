import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import BaseButton from '../Common/BaseButton';
import { useTheme } from '../../theme/ThemeContext';

const SCOPES = [
  [
    'PERSONAL',
    'Keep it personal',
    'Only you see the details. Others see totals, or what you choose to share.',
  ],
  [
    'SHARED',
    'Share with the household',
    'Everyone in the household sees these envelopes and every transaction in them.',
  ],
];

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Offers the one-time copy of this phone's data into the household. Owners and earners
// choose whether their envelopes are shared or personal (personal is the default: sharing
// exposes every transaction in them). Spenders can only keep theirs personal.
function ImportDataCard({ counts, hasIncome, role, onImport, busy, error, result }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const canShare = role === 'OWNER' || role === 'EARNER';
  const [scope, setScope] = useState('PERSONAL');

  if (result) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{'✅'} Your data is in the household</Text>
        <Text style={styles.body}>
          Uploaded {plural(result.transactions, 'transaction')} and {plural(result.envelopes, 'envelope')}
          {result.incomeImported ? ', plus your monthly income' : ''}.
        </Text>
        {result.skipped.transactions + result.skipped.envelopes > 0 ? (
          <Text style={styles.note}>
            {plural(result.skipped.transactions + result.skipped.envelopes, 'item')} couldn{'’'}t be
            uploaded (invalid dates or amounts) and stayed on this phone.
          </Text>
        ) : null}
      </View>
    );
  }

  const nothingToUpload = counts.transactions === 0 && counts.envelopes === 0 && !hasIncome;
  if (nothingToUpload) {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Bring in your data from this phone</Text>
      <Text style={styles.body}>
        Copy {plural(counts.transactions, 'transaction')} and {plural(counts.envelopes, 'envelope')}
        {hasIncome && canShare ? ' and your monthly income' : ''} to this household. Your data on
        this phone stays exactly as it is. You can only do this once.
      </Text>

      {canShare ? (
        SCOPES.map(([key, label, description]) => (
          <BaseButton
            key={key}
            onPress={() => setScope(key)}
            style={styles.scopeRow}
            accessibilityRole="radio"
            accessibilityState={{ selected: scope === key }}
          >
            <Text style={styles.radio}>{scope === key ? '◉' : '○'}</Text>
            <View style={styles.scopeTexts}>
              <Text style={styles.scopeLabel}>{label}</Text>
              <Text style={styles.scopeDescription}>{description}</Text>
            </View>
          </BaseButton>
        ))
      ) : (
        <Text style={styles.note}>
          Your envelopes and spending will be personal to you. You choose who sees the details.
        </Text>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <BaseButton
        onPress={() => onImport({ scope: canShare ? scope : 'PERSONAL' })}
        disabled={busy}
        style={[styles.button, busy && styles.disabled]}
      >
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.buttonLabel}>Upload to household</Text>
        )}
      </BaseButton>
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 24 },
    title: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 8 },
    body: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 12 },
    note: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 8 },
    scopeRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 },
    radio: { color: colors.gradientStart, fontSize: 22, width: 32, lineHeight: 26 },
    scopeTexts: { flex: 1 },
    scopeLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
    scopeDescription: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 2 },
    errorText: { color: colors.dining, fontSize: 13, lineHeight: 18, marginTop: 8 },
    button: {
      backgroundColor: colors.gradientStart,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 12,
    },
    disabled: { opacity: 0.45 },
    buttonLabel: { color: colors.white, fontSize: 15, fontWeight: '700' },
  });

export default ImportDataCard;
