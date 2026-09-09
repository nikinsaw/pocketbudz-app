import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import CustomHeader from '../Components/Common/CustomHeader';
import BaseCard from '../Components/Common/BaseCard';
import { useTheme } from '../theme/ThemeContext';
import { deleteCategory } from '../store/slices/profileSlice';

function ManageCategoriesScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const dispatch = useDispatch();

  const categories = useSelector((state) => state.profile.categories);
  const envelopes = useSelector((state) => state.budget.envelopes);
  const transactions = useSelector((state) => state.transactions.items);

  const handleDelete = (category) => {
    const envelopeCount = envelopes.filter((envelope) => envelope.categoryKey === category.key)
      .length;
    const transactionCount = transactions.filter(
      (transaction) => transaction.category === category.label,
    ).length;

    if (envelopeCount > 0 || transactionCount > 0) {
      const parts = [];
      if (envelopeCount > 0) {
        parts.push(`${envelopeCount} envelope${envelopeCount === 1 ? '' : 's'}`);
      }
      if (transactionCount > 0) {
        parts.push(`${transactionCount} transaction${transactionCount === 1 ? '' : 's'}`);
      }
      Alert.alert(
        'Category in use',
        `"${category.label}" is used by ${parts.join(' and ')}. Reassign or delete those first.`,
      );
      return;
    }

    Alert.alert('Delete category?', `"${category.label}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => dispatch(deleteCategory(category.key)),
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <CustomHeader title="Categories" leftAction="close" />
      <View style={styles.content}>
        <BaseCard style={styles.card} padding={0}>
          <View style={styles.inner}>
            {categories.map((category, index) => (
              <View
                key={category.key}
                style={[styles.row, index !== categories.length - 1 && styles.rowBorder]}
              >
                <Text style={styles.label}>
                  {category.icon} {category.label}
                </Text>
                <Pressable onPress={() => handleDelete(category)} hitSlop={12}>
                  <Text style={styles.deleteLabel}>Delete</Text>
                </Pressable>
              </View>
            ))}
            {categories.length === 0 ? (
              <Text style={styles.emptyText}>No categories yet.</Text>
            ) : null}
          </View>
        </BaseCard>
      </View>
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
    card: {},
    inner: {
      paddingHorizontal: 16,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    label: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    deleteLabel: {
      color: colors.dining,
      fontSize: 14,
      fontWeight: '700',
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 14,
      textAlign: 'center',
      paddingVertical: 20,
    },
  });

export default ManageCategoriesScreen;
