import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import {
  pick,
  keepLocalCopy,
  types as DocumentType,
  isErrorWithCode,
  errorCodes,
} from '@react-native-documents/picker';
import CustomHeader from '../Components/Common/CustomHeader';
import BaseCard from '../Components/Common/BaseCard';
import BaseButton from '../Components/Common/BaseButton';
import { useTheme } from '../theme/ThemeContext';
import { getSpendingInsight } from '../services/aiInsights';
import { parseTransactionFromPrompt } from '../services/aiTransactionParser';
import { parseTransactionsFromFile } from '../services/aiDocumentImport';
import { addTransaction } from '../store/slices/transactionsSlice';

// .flat() because DocumentType.csv is a 2-element array on Android (both
// "text/csv" and "text/comma-separated-values" mime variants) but a single
// string elsewhere — flat() normalizes both into one flat type list.
const IMPORT_FILE_TYPES = [
  DocumentType.csv,
  DocumentType.plainText,
  DocumentType.images,
  DocumentType.pdf,
].flat();

function AIAssistantScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const dispatch = useDispatch();

  const transactions = useSelector((state) => state.transactions.items);
  const envelopes = useSelector((state) => state.budget.envelopes);

  const [question, setQuestion] = useState('');
  const [askStatus, setAskStatus] = useState('idle'); // idle | loading | error
  const [answer, setAnswer] = useState('');
  const [askError, setAskError] = useState('');

  const [entryText, setEntryText] = useState('');
  const [entryStatus, setEntryStatus] = useState('idle'); // idle | loading | error | success
  const [entryError, setEntryError] = useState('');
  const [addedTransaction, setAddedTransaction] = useState(null);

  const [importStatus, setImportStatus] = useState('idle'); // idle | loading | review | error | success
  const [importError, setImportError] = useState('');
  const [importCandidates, setImportCandidates] = useState([]);
  const [importedCount, setImportedCount] = useState(0);

  const handleAsk = async () => {
    if (!question.trim() || askStatus === 'loading') {
      return;
    }
    setAskStatus('loading');
    setAskError('');
    setAnswer('');

    const result = await getSpendingInsight(question.trim(), transactions, envelopes);
    if (result.success) {
      setAnswer(result.text);
      setAskStatus('idle');
    } else {
      setAskError(result.error);
      setAskStatus('error');
    }
  };

  const handleQuickAdd = async () => {
    if (!entryText.trim() || entryStatus === 'loading') {
      return;
    }
    setEntryStatus('loading');
    setEntryError('');
    setAddedTransaction(null);

    const result = await parseTransactionFromPrompt(entryText.trim());
    if (result.success) {
      dispatch(addTransaction(result.transaction));
      setAddedTransaction(result.transaction);
      setEntryStatus('success');
      setEntryText('');
    } else {
      setEntryError(result.error);
      setEntryStatus('error');
    }
  };

  const handlePickFile = async () => {
    let picked;
    try {
      const [result] = await pick({ type: IMPORT_FILE_TYPES });
      picked = result;
    } catch (error) {
      if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      setImportStatus('error');
      setImportError("Couldn't open that file — try again.");
      return;
    }

    setImportStatus('loading');
    setImportError('');
    setImportCandidates([]);

    // pick() may hand back a content:// uri (Android) that isn't safe to
    // assume a plain filesystem reader can open — keepLocalCopy guarantees
    // a real local path first, same guarantee the old copyTo option gave.
    const [copy] = await keepLocalCopy({
      files: [{ uri: picked.uri, fileName: picked.name || 'import' }],
      destination: 'cachesDirectory',
    });
    if (copy.status !== 'success') {
      setImportError("Couldn't read that file — try again.");
      setImportStatus('error');
      return;
    }

    const result = await parseTransactionsFromFile({
      uri: copy.localUri,
      name: picked.name,
      type: picked.type,
      size: picked.size,
    });

    if (result.success) {
      setImportCandidates(result.transactions.map((t) => ({ ...t, selected: true })));
      setImportStatus('review');
    } else {
      setImportError(result.error);
      setImportStatus('error');
    }
  };

  const toggleCandidate = (index) => {
    setImportCandidates((prev) =>
      prev.map((candidate, i) =>
        i === index ? { ...candidate, selected: !candidate.selected } : candidate,
      ),
    );
  };

  const handleConfirmImport = () => {
    const selected = importCandidates.filter((candidate) => candidate.selected);
    selected.forEach(({ selected: _selected, ...transaction }) => {
      dispatch(addTransaction(transaction));
    });
    setImportedCount(selected.length);
    setImportCandidates([]);
    setImportStatus('success');
  };

  const handleCancelImport = () => {
    setImportCandidates([]);
    setImportStatus('idle');
  };

  const selectedCount = importCandidates.filter((c) => c.selected).length;

  return (
    <View style={styles.screen}>
      <CustomHeader title="AI Assistant" leftAction="close" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Ask about your spending</Text>
          <BaseCard style={styles.card}>
            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder="e.g. Where did I overspend this month?"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              multiline
            />
            <BaseButton
              onPress={handleAsk}
              disabled={askStatus === 'loading'}
              style={styles.button}
            >
              <Text style={styles.buttonLabel}>
                {askStatus === 'loading' ? 'Thinking…' : 'Ask'}
              </Text>
            </BaseButton>

            {askError ? <Text style={styles.errorText}>{askError}</Text> : null}
            {answer ? <Text style={styles.answerText}>{answer}</Text> : null}
          </BaseCard>

          <View style={styles.spacer} />

          <Text style={styles.sectionTitle}>Quick add via text</Text>
          <BaseCard style={styles.card}>
            <TextInput
              value={entryText}
              onChangeText={setEntryText}
              placeholder="e.g. ₹500 groceries yesterday"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              multiline
            />
            <BaseButton
              onPress={handleQuickAdd}
              disabled={entryStatus === 'loading'}
              style={styles.button}
            >
              <Text style={styles.buttonLabel}>
                {entryStatus === 'loading' ? 'Adding…' : 'Add'}
              </Text>
            </BaseButton>

            {entryError ? <Text style={styles.errorText}>{entryError}</Text> : null}
            {addedTransaction ? (
              <Text style={styles.answerText}>
                Added: {addedTransaction.merchant} · ₹{addedTransaction.amount} ·{' '}
                {addedTransaction.category} · {addedTransaction.date}
              </Text>
            ) : null}
          </BaseCard>

          <View style={styles.spacer} />

          <Text style={styles.sectionTitle}>Import from a file</Text>
          <BaseCard style={styles.card}>
            <Text style={styles.helperText}>
              A bank/UPI statement (CSV), a receipt photo, or a PDF statement. Extracted
              transactions are shown for review before anything is added.
            </Text>

            {importStatus !== 'review' ? (
              <BaseButton
                onPress={handlePickFile}
                disabled={importStatus === 'loading'}
                style={styles.button}
              >
                <Text style={styles.buttonLabel}>
                  {importStatus === 'loading' ? 'Reading…' : 'Choose file'}
                </Text>
              </BaseButton>
            ) : null}

            {importStatus === 'error' && importError ? (
              <Text style={styles.errorText}>{importError}</Text>
            ) : null}

            {importStatus === 'success' ? (
              <Text style={styles.answerText}>
                Added {importedCount} transaction{importedCount === 1 ? '' : 's'}.
              </Text>
            ) : null}

            {importStatus === 'review' ? (
              <View style={styles.reviewList}>
                {importCandidates.map((candidate, index) => (
                  <Pressable
                    key={`${candidate.merchant}-${candidate.date}-${index}`}
                    onPress={() => toggleCandidate(index)}
                    style={[styles.reviewRow, !candidate.selected && styles.reviewRowUnselected]}
                  >
                    <Text style={styles.reviewCheck}>{candidate.selected ? '☑' : '☐'}</Text>
                    <View style={styles.reviewDetails}>
                      <Text style={styles.reviewMerchant}>{candidate.merchant}</Text>
                      <Text style={styles.reviewMeta}>
                        {candidate.category} · {candidate.date}
                      </Text>
                    </View>
                    <Text style={styles.reviewAmount}>₹{candidate.amount}</Text>
                  </Pressable>
                ))}

                <View style={styles.reviewActions}>
                  <BaseButton onPress={handleCancelImport} style={styles.buttonSecondary}>
                    <Text style={styles.buttonSecondaryLabel}>Cancel</Text>
                  </BaseButton>
                  <BaseButton
                    onPress={handleConfirmImport}
                    disabled={selectedCount === 0}
                    style={[styles.button, selectedCount === 0 && styles.buttonDisabled]}
                  >
                    <Text style={styles.buttonLabel}>Add {selectedCount} selected</Text>
                  </BaseButton>
                </View>
              </View>
            ) : null}
          </BaseCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 40,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 12,
    },
    card: {
      marginBottom: 8,
    },
    input: {
      color: colors.text,
      fontSize: 15,
      minHeight: 44,
      textAlignVertical: 'top',
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    helperText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 12,
    },
    button: {
      alignSelf: 'flex-start',
      backgroundColor: colors.gradientStart,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 20,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonLabel: {
      color: colors.white,
      fontSize: 14,
      fontWeight: '700',
    },
    buttonSecondary: {
      alignSelf: 'flex-start',
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 20,
    },
    buttonSecondaryLabel: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
    },
    errorText: {
      color: colors.dining,
      fontSize: 13,
      marginTop: 12,
    },
    answerText: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 12,
    },
    spacer: {
      height: 28,
    },
    reviewList: {
      marginTop: 4,
    },
    reviewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    reviewRowUnselected: {
      opacity: 0.4,
    },
    reviewCheck: {
      fontSize: 18,
      color: colors.teal,
      marginRight: 12,
      width: 20,
    },
    reviewDetails: {
      flex: 1,
    },
    reviewMerchant: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    reviewMeta: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    reviewAmount: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    reviewActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 16,
    },
  });

export default AIAssistantScreen;
