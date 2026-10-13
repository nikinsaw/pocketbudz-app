import React, { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '../../theme/ThemeContext';
import { householdActions } from '../../services/householdApp';
import { selectIsHousehold } from '../../store/selectors';

// Pull-to-refresh for the data screens, for household mode only. Returns a RefreshControl
// to pass as a ScrollView's `refreshControl`, or undefined in solo mode so solo screens
// behave exactly as they did before.
export function useHouseholdRefresh() {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const household = useSelector(selectIsHousehold);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await dispatch(householdActions.syncData());
    } finally {
      setRefreshing(false);
    }
  }, [dispatch]);

  return household ? (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />
  ) : undefined;
}
