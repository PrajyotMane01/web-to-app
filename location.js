import { PermissionsAndroid, Platform } from 'react-native';

const GEOLOCATION = 'android.webkit.resource.GEOLOCATION';

export async function handleLocationRequest(resources) {
  if (!resources.includes(GEOLOCATION)) return [];
  if (Platform.OS === 'android') {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    return result === PermissionsAndroid.RESULTS.GRANTED ? [GEOLOCATION] : [];
  }
  return [GEOLOCATION];
}
