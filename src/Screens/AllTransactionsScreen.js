import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import CustomHeader from '../Components/Common/CustomHeader';
import { ActivityItem } from '../Components/Home';
import BaseCard from '../Components/Common/BaseCard';
import BaseButton from '../Components/Common/BaseButton';
import { useTheme } from '../theme/ThemeContext';
import { getActivityDisplay } from '../utils/transactionDisplay';
import { deleteTransactions } from '../store/slices/transactionsSlice';

function AddTransactionButton({ onPress, styles }) {
  return (
    <BaseCard clickable onPress={onPress} backgroundColor="transparent" style={styles.addCard}>
      <Text style={styles.addLabel}>＋ Add Transaction</Text>
    </BaseCard>
  );
}

function AllTransactionsScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const navigation = useNavigation();
  const dispatch = useDispatch();

  const transactions = useSelector((state) => state.transactions.items);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const sortedTransactions = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
  const activities = sortedTransactions.map((transaction) => getActivityDisplay(transaction, colors));
  const allSelected = activities.length > 0 && selectedIds.length === activities.length;

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const toggleSelected = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((selectedId) => selectedId !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : activities.map((activity) => activity.id));
  };

  const handleDeleteSelected = () => {
    Alert.alert(
      `Delete ${selectedIds.length} transaction${selectedIds.length === 1 ? '' : 's'}?`,
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            dispatch(deleteTransactions(selectedIds));
            exitSelectionMode();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <CustomHeader
        title="All Transactions"
        leftAction="back"
        onLeftPress={selectionMode ? exitSelectionMode : undefined}
        rightContent={
          activities.length > 0 ? (
            <Pressable onPress={() => (selectionMode ? exitSelectionMode() : setSelectionMode(true))}>
              <Text style={styles.headerAction}>{selectionMode ? 'Cancel' : 'Select'}</Text>
            </Pressable>
          ) : null
        }
      />
      {selectionMode ? (
        <View style={styles.selectionBar}>
          <Pressable onPress={toggleSelectAll}>
            <Text style={styles.headerAction}>{allSelected ? 'Deselect All' : 'Select All'}</Text>
          </Pressable>
          <Text style={styles.selectionCount}>{selectedIds.length} selected</Text>
        </View>
      ) : null}
      <FlatList
        data={activities}
        keyExtractor={(item, index) => item.id ?? String(index)}
        renderItem={({ item }) => (
          <ActivityItem
            {...item}
            selectable={selectionMode}
            selected={selectedIds.includes(item.id)}
            onToggleSelect={() => toggleSelected(item.id)}
            onPress={
              selectionMode
                ? undefined
                : () => navigation.navigate('ManageTransaction', { transactionId: item.id })
            }
          />
        )}
        ListHeaderComponent={
          selectionMode ? null : (
            <AddTransactionButton
              onPress={() => navigation.navigate('ManageTransaction')}
              styles={styles}
            />
          )
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No transactions yet — add one above.</Text>
        }
      />
      {selectionMode ? (
        <View style={styles.deleteBar}>
          <BaseButton
            onPress={handleDeleteSelected}
            disabled={selectedIds.length === 0}
            style={[styles.deleteButton, selectedIds.length === 0 && styles.deleteButtonDisabled]}
          >
            <Text style={styles.deleteButtonLabel}>
              Delete {selectedIds.length > 0 ? selectedIds.length : ''} selected
            </Text>
          </BaseButton>
        </View>
      ) : null}
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
      flexGrow: 1,
    },
    addCard: {
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.teal,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 22,
    },
    addLabel: {
      color: colors.teal,
      fontSize: 16,
      fontWeight: '700',
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 14,
      textAlign: 'center',
      marginTop: 40,
    },
    headerAction: {
      color: colors.teal,
      fontSize: 15,
      fontWeight: '600',
    },
    selectionBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    selectionCount: {
      color: colors.textMuted,
      fontSize: 14,
    },
    deleteBar: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 24,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    deleteButton: {
      backgroundColor: colors.dining,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    deleteButtonDisabled: {
      opacity: 0.5,
    },
    deleteButtonLabel: {
      color: colors.white,
      fontSize: 15,
      fontWeight: '700',
    },
  });

export default AllTransactionsScreen;
