import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import CustomHeader from '../Components/Common/CustomHeader';
import BaseButton from '../Components/Common/BaseButton';
import { useTheme } from '../theme/ThemeContext';
import { dataActions } from '../services/householdApp';
import { selectIsHousehold, selectMonthlyIncome } from '../store/selectors';
import { describeHouseholdError } from '../utils/householdErrors';

function EditIncomeScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const currentIncome = useSelector(selectMonthlyIncome);
  const isHousehold = useSelector(selectIsHousehold);
  const role = useSelector((state) => state.household.current?.role);
  // In a household, spenders have no income: their spending money is the allowance an
  // earner sets aside for them, so there is nothing to enter here.
  const isHouseholdSpender = isHousehold && role === 'SPENDER';

  const [income, setIncome] = useState(currentIncome ? String(currentIncome) : '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving) {
      return;
    }
    setError('');
    const parsed = Number(income.replace(/,/g, ''));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Enter an income amount greater than zero.');
      return;
    }
    setSaving(true);
    try {
      await dispatch(dataActions.setMonthlyIncome(parsed));
    } catch (e) {
      setError(describeHouseholdError(e, 'Couldn’t save. Please try again.'));
      setSaving(false);
      return;
    }
    navigation.goBack();
  };

  if (isHouseholdSpender) {
    return (
      <View style={styles.screen}>
        <CustomHeader title="Your spending money" leftAction="close" />
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Set aside by an earner</Text>
          <Text style={styles.helperText}>
            In a household, spenders don{'’'}t enter income. An earner sets aside an allowance for
            you each cycle, and that is what the savings and spending cards work from.
            {currentIncome
              ? ` Right now that is ₹${currentIncome.toLocaleString('en-IN')} a month.`
              : ' Nothing has been set aside for you yet. Ask an earner in your household.'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CustomHeader title="Monthly Income" leftAction="close" />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        extraScrollHeight={20}
      >
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

        {isHousehold ? (
          <Text style={styles.householdNote}>
            This is your own income. Only the owner and earners in your household can see household
            income; spenders can{'’'}t.
          </Text>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <BaseButton onPress={handleSave} disabled={saving} style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
          <Text style={styles.saveButtonLabel}>{saving ? 'Saving…' : 'Save'}</Text>
        </BaseButton>
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
    householdNote: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 12,
    },
    saveButtonDisabled: {
      opacity: 0.6,
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
