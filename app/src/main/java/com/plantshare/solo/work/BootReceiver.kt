package com.plantshare.solo.work

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.plantshare.solo.ServiceLocator
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/** Re-arms the daily check after a reboot, an update, or a timezone change. */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val pending = goAsync()
        val appContext = context.applicationContext
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val prefs = ServiceLocator.settingsStore(appContext).current()
                if (prefs.enabled) {
                    ReminderScheduler.schedule(appContext, prefs.hour, prefs.minute)
                }
            } finally {
                pending.finish()
            }
        }
    }
}
