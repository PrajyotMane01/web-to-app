package `in`.truckflow.app

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

private const val TAG = "CapsuleTest"

class CapsuleFcmService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.i(TAG, "FCM token: $token")
    }

    // Only called while the app process is alive (foreground, or backgrounded
    // but not killed). A notification+data message arriving while the app is
    // fully backgrounded/killed is shown by the system automatically and
    // never reaches here — tapping it launches MainActivity with the data
    // payload as intent extras, handled there. This matches
    // webview-template's notifications.js: no visible notification for a
    // push that arrives while the app is already open.
    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        Log.i(TAG, "onMessageReceived (foreground, no-op): ${message.data}")
    }
}
