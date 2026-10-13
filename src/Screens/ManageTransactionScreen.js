import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native';
import CustomHeader from '../Components/Common/CustomHeader';
import BaseButton from '../Components/Common/BaseButton';
import { useTheme } from '../theme/ThemeContext';
import { dataActions } from '../services/householdApp';
import { selectEnvelopes, selectIsHousehold, selectTransactions } from '../store/selectors';
import { describeHouseholdError } from '../utils/householdErrors';

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayISO() {
  return toISODate(new Date());
}

function getYesterdayISO() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return toISODate(yesterday);
}

const DATE_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'custom', label: 'Custom' },
];

// Lets the Amount field double as a tiny calculator (e.g. "120+300") instead
// of only ever accepting a plain number — handy when a bill has more than
// one line item worth adding up. Whitelisting the characters before handing
// the expression to Function() keeps this from being a general eval().
function evaluateAmountExpression(raw) {
  const expr = raw.replace(/,/g, '').trim();
  if (!expr) {
    return null;
  }
  if (!/^[0-9+\-*/.\s]+$/.test(expr)) {
    return null;
  }
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr});`)();
    return Number.isFinite(result) ? result : null;
  } catch (error) {
    return null;
  }
}

function ManageTransactionScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const route = useRoute();

  const categories = useSelector((state) => state.profile.categories);
  const transactions = useSelector(selectTransactions);
  const envelopes = useSelector(selectEnvelopes);
  const isHousehold = useSelector(selectIsHousehold);

  const transactionId = route.params?.transactionId;
  const editingTransaction = transactionId
    ? transactions.find((transaction) => transaction.id === transactionId)
    : null;
  const isEditing = !!editingTransaction;

  // A scanned bill or a parsed statement row arrives here as a draft — not
  // yet in the store — so its fields prefill the same form an existing
  // transaction would, but Save adds it fresh instead of updating anything.
  const draftTransaction = !isEditing ? route.params?.draftTransaction : null;
  const onSaved = route.params?.onSaved;
  // A row being edited inside a bulk import's review list isn't in the
  // store yet either, and shouldn't be added on its own — Save just hands
  // the corrected fields back to onSaved so the caller can update its local
  // list; the batch "Add N selected" action does the actual dispatching.
  const localOnly = !!route.params?.localOnly;
  const isReviewingDraft = !!draftTransaction;
  const initialRecord = editingTransaction || draftTransaction || null;

  const initialDateOption = (() => {
    if (!initialRecord) return 'today';
    if (initialRecord.date === getTodayISO()) return 'today';
    if (initialRecord.date === getYesterdayISO()) return 'yesterday';
    return 'custom';
  })();

  const [selectedCategory, setSelectedCategory] = useState(initialRecord?.category ?? null);
  const [merchant, setMerchant] = useState(initialRecord?.merchant ?? '');
  const [amount, setAmount] = useState(initialRecord ? String(initialRecord.amount) : '');
  const [dateOption, setDateOption] = useState(initialDateOption);
  const [customDate, setCustomDate] = useState(
    initialDateOption === 'custom' ? initialRecord.date : '',
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAmountBlur = () => {
    const evaluated = evaluateAmountExpression(amount);
    if (evaluated !== null && String(evaluated) !== amount.trim()) {
      setAmount(String(evaluated));
    }
  };

  // In a household you can only change spending you added; others' shows read-only.
  const readOnly = isEditing && editingTransaction.mine === false;

  // Spending in a category with a shared household budget is visible to the whole
  // household - say so before it is saved. (A personal budget of the same name wins and
  // keeps it private, mirroring how the server picks the envelope.)
  const sharedBudgetNotice = (() => {
    if (!isHousehold || !selectedCategory) {
      return null;
    }
    const wanted = selectedCategory.trim().toLowerCase();
    const matches = envelopes.filter((e) => e.title.trim().toLowerCase() === wanted);
    const hasPersonal = matches.some((e) => !e.shared);
    const shared = matches.find((e) => e.shared);
    return shared && !hasPersonal ? shared.title : null;
  })();

  const handleSubmit = async () => {
    if (saving) {
      return;
    }
    setError('');

    if (!selectedCategory) {
      setError('Pick a category for this transaction.');
      return;
    }
    const trimmedMerchant = merchant.trim();
    if (!trimmedMerchant) {
      setError('Enter who you paid.');
      return;
    }
    const parsedAmount = evaluateAmountExpression(amount);
    if (parsedAmount === null || parsedAmount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }

    let date;
    if (dateOption === 'today') {
      date = getTodayISO();
    } else if (dateOption === 'yesterday') {
      date = getYesterdayISO();
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(customDate)) {
        setError('Enter the date as YYYY-MM-DD.');
        return;
      }
      date = customDate;
    }

    const payload = { merchant: trimmedMerchant, category: selectedCategory, amount: parsedAmount, date };

    setSaving(true);
    try {
      if (isEditing) {
        await dispatch(dataActions.updateTransaction({ id: editingTransaction.id, ...payload }));
      } else if (!localOnly) {
        await dispatch(dataActions.addTransaction(payload));
      }
    } catch (e) {
      // Stay on the form with what they typed, and say what went wrong.
      setError(describeHouseholdError(e, 'Couldn’t save. Please try again.'));
      setSaving(false);
      return;
    }
    if (onSaved) {
      onSaved(payload);
    }
    navigation.goBack();
  };

  const handleDelete = () => {
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await dispatch(dataActions.deleteTransaction(editingTransaction.id));
          } catch (e) {
            Alert.alert('Couldn’t delete', describeHouseholdError(e));
            return;
          }
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <CustomHeader
        title={isEditing ? 'Edit Transaction' : isReviewingDraft ? 'Review Scanned Bill' : 'Add Transaction'}
        leftAction="close"
      />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        extraScrollHeight={20}
      >
        <Text style={styles.sectionTitle}>Category</Text>
          <View style={styles.chipWrap}>
            {categories.map((category) => (
              <Pressable
                key={category.key}
                onPress={() => setSelectedCategory(category.label)}
                style={[
                  styles.chip,
                  selectedCategory === category.label && styles.chipSelected,
                ]}
              >
                <Text style={styles.chipText}>
                  {category.icon} {category.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.spacer} />

          <Text style={styles.sectionTitle}>Paid to</Text>
          <TextInput
            value={merchant}
            onChangeText={setMerchant}
            placeholder="e.g. Blinkit"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />

          <View style={styles.spacer} />

          <Text style={styles.sectionTitle}>Amount</Text>
          <View style={styles.amountInputWrap}>
            <Text style={styles.amountPrefix}>₹</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              onBlur={handleAmountBlur}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="default"
              style={styles.amountInput}
            />
          </View>
          <Text style={styles.helperText}>You can add items up, e.g. 120+300</Text>

          <View style={styles.spacer} />

          <Text style={styles.sectionTitle}>Date</Text>
          <View style={styles.chipWrap}>
            {DATE_OPTIONS.map((option) => (
              <Pressable
                key={option.key}
                onPress={() => setDateOption(option.key)}
                style={[styles.chip, dateOption === option.key && styles.chipSelected]}
              >
                <Text style={styles.chipText}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          {dateOption === 'custom' ? (
            <TextInput
              value={customDate}
              onChangeText={setCustomDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.customDateInput]}
            />
          ) : null}

          {sharedBudgetNotice && !readOnly ? (
            <Text style={styles.helperText}>
              This goes to the shared {'“'}{sharedBudgetNotice}{'”'} budget, so everyone in
              your household can see it.
            </Text>
          ) : null}

          {readOnly ? (
            <Text style={styles.helperText}>
              {editingTransaction.memberName
                ? `${editingTransaction.memberName} added this, so only they can change it.`
                : 'Only the person who added this can change it.'}
            </Text>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {readOnly ? null : (
            <BaseButton onPress={handleSubmit} disabled={saving} style={[styles.saveButton, saving && styles.saveButtonDisabled]}>
              <Text style={styles.saveButtonLabel}>
                {saving
                  ? 'Saving…'
                  : isEditing
                    ? 'Save Changes'
                    : localOnly
                      ? 'Save'
                      : 'Add Transaction'}
              </Text>
            </BaseButton>
          )}

          {isEditing && !readOnly ? (
            <Pressable onPress={handleDelete} style={styles.deleteButton}>
              <Text style={styles.deleteButtonLabel}>Delete Transaction</Text>
            </Pressable>
          ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    saveButtonDisabled: {
      opacity: 0.6,
    },
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 40,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 12,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      backgroundColor: colors.card,
      borderRadius: 20,
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    chipSelected: {
      borderColor: colors.teal,
    },
    chipText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    input: {
      color: colors.text,
      fontSize: 15,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
    },
    customDateInput: {
      marginTop: 10,
    },
    spacer: {
      height: 24,
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
    helperText: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 6,
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
    deleteButton: {
      alignItems: 'center',
      marginTop: 20,
      padding: 8,
    },
    deleteButtonLabel: {
      color: colors.dining,
      fontSize: 15,
      fontWeight: '700',
    },
  });

export default ManageTransactionScreen;
