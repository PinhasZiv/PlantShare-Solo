package com.plantshare.solo.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.plantshare.solo.ServiceLocator
import com.plantshare.solo.data.Due
import com.plantshare.solo.notif.Notifications

class DailyReminderWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val context = applicationContext
        val settings = ServiceLocator.settingsStore(context)

        try {
            val prefs = settings.current()
            if (prefs.enabled) {
                val today = Due.today()
                val statuses = ServiceLocator.plantStore(context).snapshot()
                    .map { Due.statusOf(it, today) }
                    .filter { Due.shouldNotify(it) }
                    .sortedByDescending { it.daysLate }

                Notifications.showReminder(context, statuses)
            }
        } finally {
            // Always book tomorrow, even if today's check failed.
            val prefs = settings.current()
            if (prefs.enabled) {
                ReminderScheduler.schedule(context, prefs.hour, prefs.minute)
            }
        }
        return Result.success()
    }
}
