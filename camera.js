import { PermissionsAndroid, Platform } from 'react-native';

const VIDEO_CAPTURE = 'android.webkit.resource.VIDEO_CAPTURE';

export async function handleCameraRequest(resources) {
  if (!resources.includes(VIDEO_CAPTURE)) return [];
  if (Platform.OS === 'android') {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA
    );
    return result === PermissionsAndroid.RESULTS.GRANTED ? [VIDEO_CAPTURE] : [];
  }
  return [VIDEO_CAPTURE];
}
