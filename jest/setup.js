// Native modules with no real native side under Jest's Node test
// environment — @react-native/jest-preset already mocks the RN core and
// several first-party libraries (svg, gesture-handler, reanimated,
// screens), but these third-party ones need their own minimal stand-ins
// so the App smoke test can render the full tree.

jest.mock('react-native-blob-util', () => ({
  fs: {
    dirs: { CacheDir: '/mock-cache', DocumentDir: '/mock-documents' },
    writeFile: jest.fn(() => Promise.resolve()),
    readFile: jest.fn(() => Promise.resolve('')),
  },
}));

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(),
  keepLocalCopy: jest.fn(),
  saveDocuments: jest.fn(),
  types: { csv: 'text/csv', plainText: 'text/plain', images: 'image/*', pdf: 'application/pdf' },
  isErrorWithCode: jest.fn(() => false),
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
}));

jest.mock('react-native-keychain', () => ({
  getSupportedBiometryType: jest.fn(() => Promise.resolve(null)),
  setGenericPassword: jest.fn(() => Promise.resolve(true)),
  getGenericPassword: jest.fn(() => Promise.resolve(false)),
  resetGenericPassword: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('react-native-bootsplash', () => ({
  hide: jest.fn(() => Promise.resolve()),
  isVisible: jest.fn(() => Promise.resolve(false)),
}));

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(() => ({
    set: jest.fn(),
    getString: jest.fn(),
    getBoolean: jest.fn(),
    getNumber: jest.fn(),
    remove: jest.fn(),
    contains: jest.fn(() => false),
  })),
}));

// Native Google sign-in module - no native side under Jest. The real flow is
// covered with injected fakes in __tests__/googleAuth.test.js.
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() => Promise.resolve({ type: 'cancelled', data: null })),
    signOut: jest.fn(() => Promise.resolve()),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
  isErrorWithCode: jest.fn(() => false),
}));
