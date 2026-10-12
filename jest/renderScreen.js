import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../src/theme/ThemeContext';
import householdReducer from '../src/store/slices/householdSlice';
import settingsReducer from '../src/store/slices/settingsSlice';

// Renders a screen with the providers the app gives it (Redux, theme, navigation,
// safe area). `household` seeds the household slice: { user, current };
// `settings` seeds settings overrides, e.g. { householdPromoDismissed: true }.
export async function renderScreen(Screen, { household, settings } = {}) {
  const store = configureStore({
    reducer: { household: householdReducer, settings: settingsReducer },
    preloadedState: {
      ...(household ? { household } : {}),
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
  await ReactTestRenderer.act(async () => {
    await node.props.onPress();
  });
}

export const act = ReactTestRenderer.act;
