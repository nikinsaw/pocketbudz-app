import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable } from 'react-native';
import { useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import CustomHeader from '../Components/Common/CustomHeader';
import BaseButton from '../Components/Common/BaseButton';
import { useTheme } from '../theme/ThemeContext';
import {
  BASE_CATEGORIES,
  CATEGORY_QUESTIONS,
  CURRENCY_FORMATS,
  CYCLE_START_OPTIONS,
} from '../data/onboardingQuestions';
import { completeOnboarding } from '../store/slices/profileSlice';

const NAME_STEP = 0;
const FIRST_QUESTION_STEP = 1;
const CURRENCY_STEP = FIRST_QUESTION_STEP + CATEGORY_QUESTIONS.length;
const CYCLE_STEP = CURRENCY_STEP + 1;
const SUMMARY_STEP = CYCLE_STEP + 1;
const TOTAL_STEPS = SUMMARY_STEP + 1;

function resolveCategories(answers) {
  const chosen = CATEGORY_QUESTIONS.reduce((acc, question) => {
    const optionIndex = answers[question.id];
    const option = optionIndex != null ? question.options[optionIndex] : null;
    if (option?.category) {
      acc.push(option.category);
    }
    return acc;
  }, []);
  return [...BASE_CATEGORIES, ...chosen];
}

function OnboardingScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const [step, setStep] = useState(NAME_STEP);
  const [name, setName] = useState('');
  const [answers, setAnswers] = useState({});
  const [currencyFormat, setCurrencyFormat] = useState('indian');
  const [budgetCycleStartDay, setBudgetCycleStartDay] = useState(1);

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const selectCategoryAnswer = (questionId, optionIndex) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
    goNext();
  };

  const finish = (payload) => {
    dispatch(completeOnboarding(payload));
    // reset() rather than replace() — retaking onboarding from Settings
    // pushes this screen onto an existing Tabs entry, so replace() would
    // leave a stale duplicate Tabs entry underneath on the stack.
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  };

  const handleFinish = () => {
    finish({
      name: name.trim() || 'You',
      currencyFormat,
      budgetCycleStartDay,
      categories: resolveCategories(answers),
      answers,
    });
  };

  const handleSkipAll = () => {
    finish({
      name: '',
      currencyFormat: 'indian',
      budgetCycleStartDay: 1,
      categories: BASE_CATEGORIES,
      answers: {},
    });
  };

  const renderOptionList = (options, selectedIndex, onSelect) => (
    <View style={styles.optionList}>
      {options.map((option, index) => (
        <Pressable
          key={option.label}
          onPress={() => onSelect(index)}
          style={[styles.optionRow, selectedIndex === index && styles.optionRowSelected]}
        >
          <Text style={styles.optionLabel}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );

  const renderStep = () => {
    if (step === NAME_STEP) {
      return (
        <View style={styles.stepContent}>
          <Text style={styles.question}>What should we call you?</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoFocus
          />
          <BaseButton onPress={goNext} style={styles.continueButton}>
            <Text style={styles.continueLabel}>Continue</Text>
          </BaseButton>
        </View>
      );
    }

    if (step >= FIRST_QUESTION_STEP && step < CURRENCY_STEP) {
      const question = CATEGORY_QUESTIONS[step - FIRST_QUESTION_STEP];
      return (
        <View style={styles.stepContent}>
          <Text style={styles.question}>{question.question}</Text>
          {renderOptionList(question.options, answers[question.id], (index) =>
            selectCategoryAnswer(question.id, index),
          )}
        </View>
      );
    }

    if (step === CURRENCY_STEP) {
      return (
        <View style={styles.stepContent}>
          <Text style={styles.question}>Which number format feels natural to you?</Text>
          <View style={styles.optionList}>
            {CURRENCY_FORMATS.map((format) => (
              <Pressable
                key={format.key}
                onPress={() => {
                  setCurrencyFormat(format.key);
                  goNext();
                }}
                style={[
                  styles.optionRow,
                  currencyFormat === format.key && styles.optionRowSelected,
                ]}
              >
                <Text style={styles.optionLabel}>{format.label}</Text>
                <Text style={styles.optionExample}>{format.example}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    if (step === CYCLE_STEP) {
      return (
        <View style={styles.stepContent}>
          <Text style={styles.question}>When does your budget month start?</Text>
          <View style={styles.optionList}>
            {CYCLE_START_OPTIONS.map((option) => (
              <Pressable
                key={option.key}
                onPress={() => {
                  setBudgetCycleStartDay(option.key);
                  goNext();
                }}
                style={[
                  styles.optionRow,
                  budgetCycleStartDay === option.key && styles.optionRowSelected,
                ]}
              >
                <Text style={styles.optionLabel}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    // SUMMARY_STEP
    const finalCategories = resolveCategories(answers);
    return (
      <View style={styles.stepContent}>
        <Text style={styles.question}>You're all set{name.trim() ? `, ${name.trim()}` : ''}</Text>
        <Text style={styles.summarySubtitle}>Your categories:</Text>
        <View style={styles.chipWrap}>
          {finalCategories.map((category) => (
            <View key={category.key} style={styles.chip}>
              <Text style={styles.chipText}>
                {category.icon} {category.label}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.summaryHint}>
          You can change any of this later from Settings.
        </Text>
        <BaseButton onPress={handleFinish} style={styles.continueButton}>
          <Text style={styles.continueLabel}>Get Started</Text>
        </BaseButton>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <CustomHeader
        title="Set up PocketBudz"
        leftAction={step === NAME_STEP ? 'none' : 'back'}
        onLeftPress={goBack}
      />

      <View style={styles.progressRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
          <View
            key={index}
            style={[styles.dot, index <= step && styles.dotActive]}
          />
        ))}
      </View>

      {step !== SUMMARY_STEP ? (
        <Pressable onPress={handleSkipAll} style={styles.skipButton}>
          <Text style={styles.skipLabel}>Skip for now</Text>
        </Pressable>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {renderStep()}
      </ScrollView>
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    progressRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
      paddingTop: 4,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.cardBorder,
    },
    dotActive: {
      backgroundColor: colors.teal,
    },
    skipButton: {
      alignSelf: 'flex-end',
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    skipLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 40,
      flexGrow: 1,
    },
    stepContent: {
      flex: 1,
    },
    question: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 20,
    },
    input: {
      color: colors.text,
      fontSize: 16,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 20,
    },
    optionList: {
      gap: 10,
    },
    optionRow: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    optionRowSelected: {
      borderColor: colors.teal,
    },
    optionLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    optionExample: {
      color: colors.textMuted,
      fontSize: 13,
      marginTop: 2,
    },
    continueButton: {
      backgroundColor: colors.gradientStart,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 12,
    },
    continueLabel: {
      color: colors.white,
      fontSize: 15,
      fontWeight: '700',
    },
    summarySubtitle: {
      color: colors.textMuted,
      fontSize: 14,
      marginBottom: 12,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 20,
    },
    chip: {
      backgroundColor: colors.card,
      borderRadius: 20,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    chipText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
    },
    summaryHint: {
      color: colors.textMuted,
      fontSize: 13,
      marginBottom: 20,
    },
  });

export default OnboardingScreen;
