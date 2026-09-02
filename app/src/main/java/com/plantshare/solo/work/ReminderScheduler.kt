package com.plantshare.solo.work

import android.content.Context
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.util.concurrent.TimeUnit

/**
 * The app does no continuous background work. It schedules exactly one wake-up,
 * runs the check, then books the next one.
 */
object ReminderScheduler {

    const val WORK_NAME = "daily_watering_check"

    fun schedule(context: Context, hour: Int, minute: Int) {
        val request = OneTimeWorkRequestBuilder<DailyReminderWorker>()
            .setInitialDelay(millisUntilNext(hour, minute), TimeUnit.MILLISECONDS)
            .addTag(WORK_NAME)
            .build()

        WorkManager.getInstance(context)
            .enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.REPLACE, request)
    }

    fun cancel(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
    }

    fun millisUntilNext(hour: Int, minute: Int, now: LocalDateTime = LocalDateTime.now()): Long {
        var next = LocalDateTime.of(now.toLocalDate(), LocalTime.of(hour, minute))
        if (!next.isAfter(now)) {
            next = LocalDateTime.of(now.toLocalDate().plusDays(1), LocalTime.of(hour, minute))
        }
        val zone = ZoneId.systemDefault()
        return next.atZone(zone).toInstant().toEpochMilli() -
            now.atZone(zone).toInstant().toEpochMilli()
    }
}
