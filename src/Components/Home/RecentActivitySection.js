import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import ActivityItem from './ActivityItem';

function RecentActivitySection({ activities, onSeeAll }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <Pressable onPress={onSeeAll}>
          <Text style={styles.seeAll}>See All</Text>
        </Pressable>
      </View>
      {activities.map((activity, index) => (
        <ActivityItem key={activity.id ?? index} {...activity} />
      ))}
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '800',
    },
    seeAll: {
      color: colors.teal,
      fontSize: 15,
      fontWeight: '600',
    },
  });

export default RecentActivitySection;
