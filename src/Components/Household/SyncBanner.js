import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import BaseButton from '../Common/BaseButton';
import { useTheme } from '../../theme/ThemeContext';
import { householdActions } from '../../services/householdApp';
import { selectIsHousehold, selectSync } from '../../store/selectors';

// Shown on the data screens in household mode only. Tells the person when their household
// is loading, or that what they see is the last saved copy because a refresh failed.
// Renders nothing in solo mode, and nothing while everything is fine.
function SyncBanner() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const dispatch = useDispatch();
  const household = useSelector(selectIsHousehold);
  const { status, error } = useSelector(selectSync);

  // Safety net: a household whose data was never loaded (or whose cache was cleared)
  // loads when a data screen opens.
  useEffect(() => {
    if (household && status === 'idle') {
      dispatch(householdActions.syncData());
    }
  }, [dispatch, household, status]);

  if (!household) {
    return null;
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <View style={styles.banner}>
        <ActivityIndicator size="small" color={colors.teal} />
        <Text style={styles.text}>Loading your household{'…'}</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={[styles.banner, styles.errorBanner]}>
        <Text style={styles.errorText}>
          {error} Showing your last saved data.
        </Text>
        <BaseButton onPress={() => dispatch(householdActions.syncData())} hitSlop={8}>
          <Text style={styles.retry}>Retry</Text>
        </BaseButton>
      </View>
    );
  }

  return null;
}

const getStyles = (colors) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 16,
    },
    errorBanner: { backgroundColor: colors.warningTint, justifyContent: 'space-between' },
    text: { color: colors.textMuted, fontSize: 13, marginLeft: 10 },
    errorText: { color: colors.dining, fontSize: 13, lineHeight: 18, flex: 1, paddingRight: 12 },
    retry: { color: colors.teal, fontSize: 14, fontWeight: '700' },
  });

export default SyncBanner;
