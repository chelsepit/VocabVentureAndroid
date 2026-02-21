import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vocabventure.app',
  appName: 'VocabVenture',
  webDir: 'public',
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: false,
      iosKeychainPrefix: 'vocabventure',
      androidIsEncryption: false
    }
  }
};

export default config;
