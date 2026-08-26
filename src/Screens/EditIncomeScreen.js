import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import CustomHeader from '../Components/Common/CustomHeader';
import BaseButton from '../Components/Common/BaseButton';
import { useTheme } from '../theme/ThemeContext';
import { setMonthlyIncome } from '../store/slices/profileSlice';

function EditIncomeScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const currentIncome = useSelector((state) => state.profile.monthlyIncome);

  const [income, setIncome] = useState(currentIncome ? String(currentIncome) : '');
  const [error, setError] = useState('');

  const handleSave = () => {
    setError('');
    const parsed = Number(income.replace(/,/g, ''));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Enter an income amount greater than zero.');
      return;
    }
    dispatch(setMonthlyIncome(parsed));
    navigation.goBack();
  };

  return (
    <View style={styles.screen}>
      <CustomHeader title="Monthly Income" leftAction="close" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>How much do you earn per month?</Text>
          <Text style={styles.helperText}>
            Used to work out what's safe to spend, your guilt-free budget, and how much you're
            saving each cycle.
          </Text>

          <View style={styles.amountInputWrap}>
            <Text style={styles.amountPrefix}>₹</Text>
            <TextInput
              value={income}
              onChangeText={setIncome}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={styles.amountInput}
              autoFocus
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <BaseButton onPress={handleSave} style={styles.saveButton}>
            <Text style={styles.saveButtonLabel}>Save</Text>
          </BaseButton>
        </View>
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
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 8,
    },
    helperText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 24,
    },
    amountInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingHorizontal: 16,
    },
    amountPrefix: {
      color: colors.textMuted,
      fontSize: 20,
      fontWeight: '700',
      marginRight: 6,
    },
    amountInput: {
      flex: 1,
      color: colors.text,
      fontSize: 20,
      fontWeight: '700',
      paddingVertical: 14,
    },
    errorText: {
      color: colors.dining,
      fontSize: 13,
      marginTop: 12,
    },
    saveButton: {
      backgroundColor: colors.gradientStart,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 24,
    },
    saveButtonLabel: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '700',
    },
  });

export default EditIncomeScreen;
