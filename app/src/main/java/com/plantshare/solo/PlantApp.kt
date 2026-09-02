package com.plantshare.solo

import android.app.Application
import com.plantshare.solo.notif.Notifications
import com.plantshare.solo.work.ReminderScheduler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class PlantApp : Application() {

    override fun onCreate() {
        super.onCreate()
        Notifications.createChannels(this)

        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            val prefs = ServiceLocator.settingsStore(this@PlantApp).current()
            if (prefs.enabled) {
                ReminderScheduler.schedule(this@PlantApp, prefs.hour, prefs.minute)
            }
        }
    }
}
