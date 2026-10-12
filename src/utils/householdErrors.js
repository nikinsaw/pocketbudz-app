// Turns the errors the household flow can throw into short text a person can act on.
// GoogleSignInError carries a `reason`; ApiError carries an HTTP `status` (0 = offline).

export function isCancelled(error) {
  return error?.reason === 'cancelled' || error?.reason === 'in-progress';
}

export function describeHouseholdError(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) {
    return fallback;
  }
  if (error.reason === 'play-services') {
    return 'Google Play services are missing or out of date on this phone.';
  }
  if (error.reason === 'not-configured') {
    return 'Household Mode isn’t set up in this build yet.';
  }
  if (error.reason === 'no-token') {
    return 'Google didn’t complete the sign-in. Please try again.';
  }
  if (error.status === 0) {
    return 'Can’t reach the server. Check your internet connection and try again.';
  }
  if (error.status === 429) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (error.status >= 500) {
    return 'The server had a problem. Please try again shortly.';
  }
  // 4xx messages come from our own API and are written for people ("Invalid or
  // expired invite", "You are already in a household").
  if (error.status >= 400 && error.message) {
    return error.message;
  }
  return fallback;
}
