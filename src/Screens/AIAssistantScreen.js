import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import CustomHeader from '../Components/Common/CustomHeader';
import BaseCard from '../Components/Common/BaseCard';
import BaseButton from '../Components/Common/BaseButton';
import { useTheme } from '../theme/ThemeContext';
import { getSpendingInsight } from '../services/aiInsights';
import { parseTransactionFromPrompt } from '../services/aiTransactionParser';
import { addTransaction } from '../store/slices/transactionsSlice';

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
    button: {
      alignSelf: 'flex-start',
      backgroundColor: colors.gradientStart,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 20,
    },
    buttonLabel: {
      color: colors.white,
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
  });

export default AIAssistantScreen;
