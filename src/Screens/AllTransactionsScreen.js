import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import CustomHeader from '../Components/Common/CustomHeader';
import { ActivityItem } from '../Components/Home';
import BaseCard from '../Components/Common/BaseCard';
import { useTheme } from '../theme/ThemeContext';
import { getActivityDisplay } from '../utils/transactionDisplay';

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

  const transactions = useSelector((state) => state.transactions.items);

  const sortedTransactions = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
  const activities = sortedTransactions.map((transaction) => getActivityDisplay(transaction, colors));

  return (
    <View style={styles.screen}>
      <CustomHeader title="All Transactions" leftAction="back" />
      <FlatList
        data={activities}
        keyExtractor={(item, index) => item.id ?? String(index)}
        renderItem={({ item }) => (
          <ActivityItem
            {...item}
            onPress={() =>
              navigation.navigate('ManageTransaction', { transactionId: item.id })
            }
          />
        )}
        ListHeaderComponent={
          <AddTransactionButton
            onPress={() => navigation.navigate('ManageTransaction')}
            styles={styles}
          />
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No transactions yet — add one above.</Text>
        }
      />
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
  });

export default AllTransactionsScreen;
