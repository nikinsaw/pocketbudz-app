import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useSelector } from 'react-redux';
import CustomHeader from '../Components/Common/CustomHeader';
import { ActivityItem } from '../Components/Home';
import { useTheme } from '../theme/ThemeContext';
import { getActivityDisplay } from '../utils/transactionDisplay';

function AllTransactionsScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const transactions = useSelector((state) => state.transactions.items);

  const sortedTransactions = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
  const activities = sortedTransactions.map((transaction) => getActivityDisplay(transaction, colors));

  return (
    <View style={styles.screen}>
      <CustomHeader title="All Transactions" leftAction="back" />
      <FlatList
        data={activities}
        keyExtractor={(item, index) => item.id ?? String(index)}
        renderItem={({ item }) => <ActivityItem {...item} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No transactions yet — add one from the AI Assistant.</Text>
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
    emptyText: {
      color: colors.textMuted,
      fontSize: 14,
      textAlign: 'center',
      marginTop: 40,
    },
  });

export default AllTransactionsScreen;
