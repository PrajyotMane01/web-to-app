import { PermissionsAndroid, Platform } from 'react-native';

const AUDIO_CAPTURE = 'android.webkit.resource.AUDIO_CAPTURE';

export async function handleMicrophoneRequest(resources) {
  if (!resources.includes(AUDIO_CAPTURE)) return [];
  if (Platform.OS === 'android') {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
    );
    return result === PermissionsAndroid.RESULTS.GRANTED ? [AUDIO_CAPTURE] : [];
  }
  return [AUDIO_CAPTURE];
}
