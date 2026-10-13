import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../src/theme/ThemeContext';
import householdReducer from '../src/store/slices/householdSlice';
import householdDataReducer from '../src/store/slices/householdDataSlice';
import settingsReducer from '../src/store/slices/settingsSlice';
import budgetReducer from '../src/store/slices/budgetSlice';
import transactionsReducer from '../src/store/slices/transactionsSlice';
import profileReducer from '../src/store/slices/profileSlice';

// Renders a screen with the providers the app gives it (Redux, theme, navigation,
// safe area). `household` seeds the household slice: { user, current };
// `settings` seeds settings overrides, e.g. { householdPromoDismissed: true };
// `phone` seeds the on-device data: { envelopes, transactions, monthlyIncome }.
export async function renderScreen(Screen, { household, settings, phone } = {}) {
  const store = configureStore({
    reducer: {
      household: householdReducer,
      householdData: householdDataReducer,
      settings: settingsReducer,
      budget: budgetReducer,
      transactions: transactionsReducer,
      profile: profileReducer,
    },
    preloadedState: {
      ...(household ? { household: { importedFor: null, ...household } } : {}),
      ...(phone
        ? {
            budget: { envelopes: phone.envelopes ?? [] },
            transactions: { items: phone.transactions ?? [] },
            profile: { ...profileReducer(undefined, { type: '@@init' }), monthlyIncome: phone.monthlyIncome ?? null },
          }
        : {}),
      ...(settings ? { settings: { ...settingsReducer(undefined, { type: '@@init' }), ...settings } } : {}),
    },
  });
  let renderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 360, height: 800 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <Provider store={store}>
          <ThemeProvider>
            <NavigationContainer>
              <Screen />
            </NavigationContainer>
          </ThemeProvider>
        </Provider>
      </SafeAreaProvider>,
    );
  });
  return { store, renderer, root: renderer.root };
}

const flatten = (children) =>
  [].concat(children ?? []).map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : '')).join('');

// All visible text on screen, in order.
export function allText(root) {
  return root
    .findAll((node) => typeof node.type === 'string' && node.type === 'Text')
    .map((node) => flatten(node.props.children))
    .filter(Boolean);
}

export const hasText = (root, text) => allText(root).some((t) => t.includes(text));

// Presses the nearest pressable ancestor of the first Text containing `text`.
export async function pressText(root, text) {
  const label = root.findAll(
    (node) => node.type === 'Text' && flatten(node.props.children).includes(text),
  )[0];
  if (!label) {
    throw new Error(`No text containing "${text}" on screen. Saw: ${allText(root).join(' | ')}`);
  }
  let node = label;
  while (node && !(typeof node.props.onPress === 'function')) {
    node = node.parent;
  }
  if (!node) {
    throw new Error(`"${text}" is not inside anything pressable`);
  }
  // A real tap on a disabled button does nothing (Pressable swallows it), so
  // neither does this - otherwise tests could "press" buttons users cannot.
  if (node.props.disabled === true) {
    return;
  }
  await ReactTestRenderer.act(async () => {
    await node.props.onPress();
  });
}

export const act = ReactTestRenderer.act;

// Types into the TextInput with this placeholder.
export async function typeInto(root, placeholder, text) {
  const input = root.findAll(
    (node) => node.props.placeholder === placeholder && node.props.onChangeText,
  )[0];
  if (!input) {
    throw new Error(`No input with placeholder "${placeholder}"`);
  }
  await ReactTestRenderer.act(async () => {
    input.props.onChangeText(text);
  });
}

// The button (accessibilityRole="button") whose label contains `text`, so tests can
// inspect its disabled state.
export function buttonWithText(root, text) {
  let node = root.findAll(
    (n) => n.type === 'Text' && flatten(n.props.children).includes(text),
  )[0];
  while (node && node.props.accessibilityRole !== 'button') {
    node = node.parent;
  }
  return node;
}

export const isDisabled = (button) => button.props.accessibilityState?.disabled === true;
