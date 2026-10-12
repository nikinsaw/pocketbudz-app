import { useEffect } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { api } from '../../services/api';
import { householdActions } from '../../services/householdApp';
import { signedOut } from '../../store/slices/householdSlice';

// Renders nothing. Wires the API client's "session is over" signal into Redux, and
// at launch re-checks a saved household session. Solo users (no account) skip the
// network entirely, so household mode adds zero requests for them.
function HouseholdBootstrap() {
  const dispatch = useDispatch();
  const store = useStore();

  useEffect(() => {
    api.setOnSignedOut(() => dispatch(signedOut()));
    if (store.getState().household.user) {
      // Offline is fine (cached state is kept); other failures are retried when the
      // Household screen opens, so nothing to surface here.
      dispatch(householdActions.restore()).catch(() => {});
    }
  }, [dispatch, store]);

  return null;
}

export default HouseholdBootstrap;
