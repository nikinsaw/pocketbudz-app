import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSelector } from 'react-redux';
import CustomHeader from '../Components/Common/CustomHeader';
import BaseCard from '../Components/Common/BaseCard';
import BaseButton from '../Components/Common/BaseButton';
import { useTheme } from '../theme/ThemeContext';
import { getSpendingInsight } from '../services/aiInsights';

function AskSpendingScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const transactions = useSelector((state) => state.transactions.items);
  const envelopes = useSelector((state) => state.budget.envelopes);

  const [question, setQuestion] = useState('');
  const [askStatus, setAskStatus] = useState('idle'); // idle | loading | error
  const [answer, setAnswer] = useState('');
  const [askError, setAskError] = useState('');

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

  return (
    <View style={styles.screen}>
      <CustomHeader title="Ask about your spending" leftAction="close" />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        extraScrollHeight={20}
      >
        <BaseCard style={styles.card}>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="e.g. Where did I overspend this month?"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            autoFocus
          />
          <BaseButton onPress={handleAsk} disabled={askStatus === 'loading'} style={styles.button}>
            <Text style={styles.buttonLabel}>{askStatus === 'loading' ? 'Thinking…' : 'Ask'}</Text>
          </BaseButton>

          {askError ? <Text style={styles.errorText}>{askError}</Text> : null}
          {answer ? <Text style={styles.answerText}>{answer}</Text> : null}
        </BaseCard>
      </KeyboardAwareScrollView>
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 40,
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
  });

export default AskSpendingScreen;
