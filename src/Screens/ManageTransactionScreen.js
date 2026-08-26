import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native';
import CustomHeader from '../Components/Common/CustomHeader';
import BaseButton from '../Components/Common/BaseButton';
import { useTheme } from '../theme/ThemeContext';
import { addTransaction, updateTransaction, deleteTransaction } from '../store/slices/transactionsSlice';

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

function ManageTransactionScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const route = useRoute();

  const categories = useSelector((state) => state.profile.categories);
  const transactions = useSelector((state) => state.transactions.items);

  const transactionId = route.params?.transactionId;
  const editingTransaction = transactionId
    ? transactions.find((transaction) => transaction.id === transactionId)
    : null;
  const isEditing = !!editingTransaction;

  const initialDateOption = (() => {
    if (!editingTransaction) return 'today';
    if (editingTransaction.date === getTodayISO()) return 'today';
    if (editingTransaction.date === getYesterdayISO()) return 'yesterday';
    return 'custom';
  })();

  const [selectedCategory, setSelectedCategory] = useState(editingTransaction?.category ?? null);
  const [merchant, setMerchant] = useState(editingTransaction?.merchant ?? '');
  const [amount, setAmount] = useState(
    editingTransaction ? String(editingTransaction.amount) : '',
  );
  const [dateOption, setDateOption] = useState(initialDateOption);
  const [customDate, setCustomDate] = useState(
    initialDateOption === 'custom' ? editingTransaction.date : '',
  );
  const [error, setError] = useState('');

  const handleSubmit = () => {
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
    const parsedAmount = Number(amount.replace(/,/g, ''));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
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

    if (isEditing) {
      dispatch(updateTransaction({ id: editingTransaction.id, ...payload }));
    } else {
      dispatch(addTransaction(payload));
    }
    navigation.goBack();
  };

  const handleDelete = () => {
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          dispatch(deleteTransaction(editingTransaction.id));
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <CustomHeader title={isEditing ? 'Edit Transaction' : 'Add Transaction'} leftAction="close" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={styles.amountInput}
            />
          </View>

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

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <BaseButton onPress={handleSubmit} style={styles.saveButton}>
            <Text style={styles.saveButtonLabel}>
              {isEditing ? 'Save Changes' : 'Add Transaction'}
            </Text>
          </BaseButton>

          {isEditing ? (
            <Pressable onPress={handleDelete} style={styles.deleteButton}>
              <Text style={styles.deleteButtonLabel}>Delete Transaction</Text>
            </Pressable>
          ) : null}
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
