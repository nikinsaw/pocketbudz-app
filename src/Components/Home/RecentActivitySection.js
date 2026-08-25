import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

function ActivityItem({ icon, iconBackground, name, subtitle, amount, styles }) {
  return (
    <View style={styles.item}>
      <View style={[styles.iconWrap, { backgroundColor: iconBackground }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.details}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.amount}>-₹{amount}</Text>
    </View>
  );
}

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
        <ActivityItem key={activity.id ?? index} {...activity} styles={styles} />
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
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 22,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    icon: {
      fontSize: 20,
    },
    details: {
      flex: 1,
    },
    name: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      marginTop: 2,
    },
    amount: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
  });

export default RecentActivitySection;
